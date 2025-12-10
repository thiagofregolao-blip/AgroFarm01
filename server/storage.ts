import { randomUUID } from "crypto";
import type { 
  User, InsertUser, Category, InsertCategory, Product, InsertProduct,
  Region, InsertRegion, Client, InsertClient, Season, InsertSeason,
  SeasonGoal, InsertSeasonGoal, Sale, InsertSale, SeasonParameter,
  InsertSeasonParameter, SalesHistory, MarketInvestmentRate, ClientMarketRate, InsertClientMarketRate,
  ClientMarketValue, InsertClientMarketValue,
  MarketBenchmark, InsertMarketBenchmark, ExternalPurchase, InsertExternalPurchase,
  ClientFamilyRelation, InsertClientFamilyRelation, AlertSettings, InsertAlertSettings,
  Alert, InsertAlert, PurchaseHistory, InsertPurchaseHistory, PurchaseHistoryItem, InsertPurchaseHistoryItem,
  MasterClient, InsertMasterClient, UserClientLink, InsertUserClientLink,
  BarterProduct, InsertBarterProduct, BarterSettings, InsertBarterSettings,
  BarterSimulation, InsertBarterSimulation, BarterSimulationItem, InsertBarterSimulationItem,
  SalesTarget, InsertSalesTarget
} from "@shared/schema";
import { db, pool } from './db';
import { users, categories, products, regions, clients, seasons, seasonGoals, sales, seasonParameters, marketInvestmentRates, clientMarketRates, clientMarketValues, marketBenchmarks, externalPurchases, clientFamilyRelations, alertSettings, alerts, purchaseHistory, purchaseHistoryItems, masterClients, userClientLinks, barterProducts, barterSettings, barterSimulations, barterSimulationItems, salesTargets, systemSettings } from '@shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Categories
  getAllCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;

  // Regions
  getAllRegions(): Promise<Region[]>;
  createRegion(region: InsertRegion): Promise<Region>;

  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getTop80_20Clients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  getClientsForUser(userId: string, top8020Only?: boolean): Promise<Client[]>;

  // Master Clients
  getAllMasterClients(): Promise<MasterClient[]>;
  getMasterClient(id: string): Promise<MasterClient | undefined>;
  findMasterClientByName(name: string): Promise<MasterClient | undefined>;
  createMasterClient(client: InsertMasterClient): Promise<MasterClient>;
  updateMasterClient(id: string, client: Partial<InsertMasterClient>): Promise<MasterClient | undefined>;
  deleteMasterClient(id: string): Promise<boolean>;
  mergeMasterClients(sourceId: string, targetId: string): Promise<boolean>;

  // User Client Links
  getUserClientLinks(userId: string): Promise<UserClientLink[]>;
  getUserClientLink(userId: string, masterClientId: string): Promise<UserClientLink | undefined>;
  createUserClientLink(link: InsertUserClientLink): Promise<UserClientLink>;
  updateUserClientLink(id: string, link: Partial<InsertUserClientLink>): Promise<UserClientLink | undefined>;
  deleteUserClientLink(id: string): Promise<boolean>;

  // Seasons
  getAllSeasons(): Promise<Season[]>;
  getActiveSeason(): Promise<Season | undefined>;
  createSeason(season: InsertSeason): Promise<Season>;

  // Season Goals
  getAllSeasonGoals(): Promise<SeasonGoal[]>;
  getSeasonGoal(seasonId: string, userId: string): Promise<SeasonGoal | undefined>;
  createSeasonGoal(goal: InsertSeasonGoal): Promise<SeasonGoal>;
  updateSeasonGoal(id: string, goal: Partial<InsertSeasonGoal>): Promise<SeasonGoal | undefined>;

  // Sales
  getAllSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  getSalesByClient(clientId: string): Promise<Sale[]>;
  getSalesBySeason(seasonId: string): Promise<Sale[]>;
  getSaleByOrderCode(orderCode: string, userId: string): Promise<Sale | undefined>;
  getExistingOrderCodes(userId: string): Promise<Set<string>>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale | undefined>;
  
  // Import Batches
  getImportBatches(): Promise<Array<{
    batchId: string;
    importDate: Date;
    salesCount: number;
    totalAmount: number;
    totalCommissions: number;
    userId: string;
  }>>;
  deleteImportBatch(batchId: string): Promise<void>;

  // Season Parameters
  getAllSeasonParameters(): Promise<SeasonParameter[]>;
  createSeasonParameter(parameter: InsertSeasonParameter): Promise<SeasonParameter>;

  // Market Investment Rates
  getMarketInvestmentRates(): Promise<MarketInvestmentRate[]>;
  
  // Client Market Rates
  getClientMarketRates(clientId: string, userId: string, seasonId: string): Promise<ClientMarketRate[]>;
  upsertClientMarketRate(rate: InsertClientMarketRate): Promise<ClientMarketRate>;
  deleteClientMarketRate(clientId: string, categoryId: string, userId: string, seasonId: string): Promise<boolean>;

  // Client Market Values (Mercado)
  getClientMarketValues(clientId: string, userId: string, seasonId: string): Promise<ClientMarketValue[]>;
  upsertClientMarketValue(value: InsertClientMarketValue): Promise<ClientMarketValue>;
  deleteClientMarketValue(clientId: string, categoryId: string, userId: string, seasonId: string): Promise<boolean>;

  // Market Benchmarks
  getMarketBenchmarks(userId: string, seasonId: string): Promise<MarketBenchmark[]>;
  upsertMarketBenchmark(benchmark: InsertMarketBenchmark): Promise<MarketBenchmark>;
  deleteMarketBenchmark(userId: string, categoryId: string, seasonId: string): Promise<boolean>;

  // Market Potential
  getMarketPotentialByCategory(userId: string, seasonId: string): Promise<Array<{
    categoryId: string;
    categoryName: string;
    marketArea: number;
    investmentPerHa: number;
    totalPotential: number;
  }>>;

  // External Purchases
  getExternalPurchases(clientId: string, userId: string, seasonId: string): Promise<ExternalPurchase[]>;
  upsertExternalPurchase(purchase: InsertExternalPurchase): Promise<ExternalPurchase>;
  deleteExternalPurchase(userId: string, clientId: string, categoryId: string, seasonId: string): Promise<boolean>;

  // Client Family Relations
  getClientFamilyRelations(clientId: string, userId: string): Promise<string[]>;
  getBatchClientFamilyRelations(clientIds: string[], userId: string): Promise<Map<string, string[]>>;
  addClientFamilyRelation(relation: InsertClientFamilyRelation): Promise<ClientFamilyRelation>;
  removeClientFamilyRelation(clientId: string, relatedClientId: string, userId: string): Promise<boolean>;

  // Alert Settings
  getAlertSettings(userId: string): Promise<AlertSettings | undefined>;
  upsertAlertSettings(settings: InsertAlertSettings): Promise<AlertSettings>;

  // Alerts
  getAlerts(userId: string): Promise<Alert[]>;
  getUnreadAlertsCount(userId: string): Promise<number>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertAsRead(alertId: string, userId: string): Promise<boolean>;
  markAllAlertsAsRead(userId: string): Promise<boolean>;
  deleteAlert(alertId: string, userId: string): Promise<boolean>;

  // Purchase History
  getPurchaseHistories(userId: string, clientId?: string, seasonId?: string): Promise<PurchaseHistory[]>;
  getPurchaseHistory(id: string, userId: string): Promise<PurchaseHistory | undefined>;
  createPurchaseHistory(history: InsertPurchaseHistory): Promise<PurchaseHistory>;
  deletePurchaseHistory(id: string, userId: string): Promise<boolean>;
  getPurchaseHistoryItems(purchaseHistoryId: string): Promise<PurchaseHistoryItem[]>;
  createPurchaseHistoryItem(item: InsertPurchaseHistoryItem): Promise<PurchaseHistoryItem>;

  // Analytics
  getSalesAnalytics(seasonId?: string, userId?: string): Promise<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }>;

  getOpportunityAlerts(clientId?: string): Promise<{
    clientId: string;
    clientName: string;
    missingProducts: string[];
    category: string;
    region: string;
    severity: 'high' | 'medium' | 'low';
  }[]>;

  // Barter Module
  getAllBarterProducts(): Promise<BarterProduct[]>;
  createBarterProduct(product: InsertBarterProduct): Promise<BarterProduct>;
  updateBarterProduct(id: string, product: Partial<InsertBarterProduct>): Promise<BarterProduct | undefined>;
  deleteBarterProduct(id: string): Promise<boolean>;
  deleteAllBarterProducts(): Promise<void>;
  getAllBarterSettings(): Promise<BarterSettings[]>;
  upsertBarterSetting(key: string, value: string, description?: string): Promise<BarterSettings>;
  getBarterSimulationsByUser(userId: string): Promise<BarterSimulation[]>;
  getBarterSimulation(id: string): Promise<BarterSimulation | undefined>;
  createBarterSimulation(simulation: InsertBarterSimulation, items: InsertBarterSimulationItem[]): Promise<BarterSimulation>;
  updateBarterSimulation(id: string, simulation: Partial<InsertBarterSimulation>): Promise<BarterSimulation | undefined>;
  deleteBarterSimulation(id: string): Promise<boolean>;

  // Sales Targets - Kanban de Metas
  getKanbanData(userId: string, seasonId: string): Promise<any>;
  getSalesTargets(userId: string, seasonId?: string): Promise<any[]>;
  createSalesTarget(userId: string, clientId: string, segmento: string, valorCapturado: number, seasonId: string, subcategories?: Record<string, number>): Promise<any>;
  updateSalesTarget(id: string, valorCapturado: number, subcategories?: Record<string, number>): Promise<any>;
  deleteSalesTarget(id: string, userId: string): Promise<boolean>;

  // System Settings
  getSystemSettings(): Promise<{ allowUserRegistration: boolean } | undefined>;
}

export class MemStorage implements IStorage {
  sessionStore: session.Store;
  private users: Map<string, User> = new Map();
  private categories: Map<string, Category> = new Map();
  private products: Map<string, Product> = new Map();
  private regions: Map<string, Region> = new Map();
  private clients: Map<string, Client> = new Map();
  private masterClients: Map<string, MasterClient> = new Map();
  private userClientLinks: Map<string, UserClientLink> = new Map();
  private seasons: Map<string, Season> = new Map();
  private seasonGoals: Map<string, SeasonGoal> = new Map();
  private sales: Map<string, Sale> = new Map();
  private seasonParameters: Map<string, SeasonParameter> = new Map();
  private barterProducts: Map<string, any> = new Map();
  private barterSettings: Map<string, any> = new Map();
  private barterSimulations: Map<string, any> = new Map();

  constructor() {
    this.sessionStore = new session.MemoryStore();
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize categories based on commission table
    const categoryData = [
      {
        id: "cat-fertilizantes",
        name: "Fertilizantes",
        type: "fertilizantes",
        greenCommission: "0.30",
        greenMarginMin: "7.00",
        yellowCommission: "0.20",
        yellowMarginMin: "6.00",
        yellowMarginMax: "6.99",
        redCommission: "0.18",
        redMarginMin: "4.00",
        redMarginMax: "4.99",
        belowListCommission: "0.15",
        defaultIva: "10.00",
      },
      {
        id: "cat-sem-diversas",
        name: "Sementes Diversas",
        type: "sementes",
        greenCommission: "1.00",
        greenMarginMin: "13.00",
        yellowCommission: "0.70",
        yellowMarginMin: "10.00",
        yellowMarginMax: "12.99",
        redCommission: "0.40",
        redMarginMin: "8.00",
        redMarginMax: "9.99",
        belowListCommission: "0.15",
        defaultIva: "10.00",
      },
      {
        id: "cat-sem-trigo",
        name: "Sementes Trigo",
        type: "sementes",
        greenCommission: "1.00",
        greenMarginMin: "13.00",
        yellowCommission: "0.70",
        yellowMarginMin: "10.00",
        yellowMarginMax: "12.99",
        redCommission: "0.40",
        redMarginMin: "8.00",
        redMarginMax: "9.99",
        belowListCommission: "0.15",
        defaultIva: "10.00",
      },
      {
        id: "cat-sem-milho",
        name: "Sementes Milho",
        type: "sementes",
        greenCommission: "2.50",
        greenMarginMin: "20.00",
        yellowCommission: "2.00",
        yellowMarginMin: "15.00",
        yellowMarginMax: "19.99",
        redCommission: "1.50",
        redMarginMin: "10.00",
        redMarginMax: "14.99",
        belowListCommission: "0.50",
        defaultIva: "10.00",
      },
      {
        id: "cat-sem-soja",
        name: "Sementes Soja",
        type: "sementes",
        greenCommission: "2.50",
        greenMarginMin: "20.00",
        yellowCommission: "2.00",
        yellowMarginMin: "15.00",
        yellowMarginMax: "19.99",
        redCommission: "1.50",
        redMarginMin: "10.00",
        redMarginMax: "14.99",
        belowListCommission: "0.50",
        defaultIva: "10.00",
      },
      {
        id: "cat-especialidades",
        name: "Especialidades",
        type: "especialidades",
        greenCommission: "4.00",
        greenMarginMin: "25.00",
        yellowCommission: "3.00",
        yellowMarginMin: "20.00",
        yellowMarginMax: "24.99",
        redCommission: "2.00",
        redMarginMin: "15.00",
        redMarginMax: "19.99",
        belowListCommission: "1.00",
        defaultIva: "10.00",
      },
      {
        id: "cat-agroquimicos",
        name: "Agroquímicos",
        type: "agroquimicos",
        greenCommission: "1.00",
        greenMarginMin: "13.00",
        yellowCommission: "0.70",
        yellowMarginMin: "10.00",
        yellowMarginMax: "12.99",
        redCommission: "0.40",
        redMarginMin: "7.00",
        redMarginMax: "9.99",
        belowListCommission: "0.15",
        defaultIva: "10.00",
      },
    ];

    categoryData.forEach(cat => {
      this.categories.set(cat.id, cat as Category);
    });

    // Initialize regions
    const regionData = [
      { id: "reg-alto-parana", name: "Alto Paraná", country: "Paraguay" },
      { id: "reg-itapua", name: "Itapúa", country: "Paraguay" },
      { id: "reg-canindeyu", name: "Canindeyú", country: "Paraguay" },
      { id: "reg-caaguazu", name: "Caaguazú", country: "Paraguay" },
    ];

    regionData.forEach(region => {
      this.regions.set(region.id, region as Region);
    });

    // Initialize season parameters
    const seasonParamData = [
      {
        id: "sp-soja-verao",
        type: "soja_verao",
        dueDateMonth: 3,
        dueDateDay: 30,
        labelPattern: "Soja {year}/{next_year}",
      },
      {
        id: "sp-soja-verao-alt",
        type: "soja_verao",
        dueDateMonth: 4,
        dueDateDay: 30,
        labelPattern: "Soja {year}/{next_year}",
      },
      {
        id: "sp-soja-safrinha",
        type: "soja_safrinha",
        dueDateMonth: 6,
        dueDateDay: 30,
        labelPattern: "Soja Safrinha {year}",
      },
      {
        id: "sp-milho",
        type: "milho",
        dueDateMonth: 8,
        dueDateDay: 30,
        labelPattern: "Milho {year}/{year}",
      },
      {
        id: "sp-trigo",
        type: "trigo",
        dueDateMonth: 10,
        dueDateDay: 30,
        labelPattern: "Trigo {year}",
      },
    ];

    seasonParamData.forEach(param => {
      this.seasonParameters.set(param.id, param as SeasonParameter);
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role ?? "vendedor"
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...user };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Category methods
  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const newCategory: Category = { 
      ...category, 
      id,
      defaultIva: category.defaultIva ?? "10.00"
    };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const existing = this.categories.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...category };
    this.categories.set(id, updated);
    return updated;
  }

  // Product methods
  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => p.isActive);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => p.categoryId === categoryId && p.isActive);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const newProduct: Product = { 
      ...product, 
      id,
      subcategoryId: product.subcategoryId ?? null,
      description: product.description ?? null,
      marca: product.marca ?? null,
      packageSize: product.packageSize ?? null,
      segment: product.segment ?? null,
      isActive: product.isActive ?? true
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...product };
    this.products.set(id, updated);
    return updated;
  }

  // Region methods
  async getAllRegions(): Promise<Region[]> {
    return Array.from(this.regions.values());
  }

  async createRegion(region: InsertRegion): Promise<Region> {
    const id = randomUUID();
    const newRegion: Region = { 
      ...region, 
      id,
      country: region.country ?? "Paraguay"
    };
    this.regions.set(id, newRegion);
    return newRegion;
  }

  // Client methods
  async getAllClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(c => c.isActive);
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getTop80_20Clients(): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(c => c.isTop80_20 && c.isActive);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = randomUUID();
    const newClient: Client = { 
      ...client, 
      id,
      cultures: client.cultures ?? [],
      plantingProgress: client.plantingProgress ?? "0.00",
      isTop80_20: client.isTop80_20 ?? false,
      includeInMarketArea: client.includeInMarketArea ?? false,
      isActive: client.isActive ?? true,
      userId: client.userId ?? null
    };
    this.clients.set(id, newClient);
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const existing = this.clients.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...client };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  async getClientsForUser(userId: string, top8020Only?: boolean): Promise<Client[]> {
    // Para MemStorage, retornar clientes antigos (tabela clients)
    const allClients = Array.from(this.clients.values());
    return allClients.filter(c => 
      c.userId === userId && 
      c.isActive &&
      (!top8020Only || c.isTop80_20)
    );
  }

  // Master Clients (stub methods for MemStorage - not used in production)
  async getAllMasterClients(): Promise<MasterClient[]> {
    return Array.from(this.masterClients.values()).filter(c => c.isActive);
  }

  async getMasterClient(id: string): Promise<MasterClient | undefined> {
    return this.masterClients.get(id);
  }

  async findMasterClientByName(name: string): Promise<MasterClient | undefined> {
    const normalizedSearch = name.toUpperCase().trim().replace(/[.,\-\s]/g, '');
    return Array.from(this.masterClients.values()).find(client => {
      const normalizedClientName = client.name.toUpperCase().trim().replace(/[.,\-\s]/g, '');
      return normalizedClientName === normalizedSearch && client.isActive;
    });
  }

  async createMasterClient(client: InsertMasterClient): Promise<MasterClient> {
    const id = randomUUID();
    const now = new Date();
    const newClient: MasterClient = { 
      ...client, 
      id,
      regionId: client.regionId ?? null,
      plantingArea: client.plantingArea ?? null,
      cultures: client.cultures ?? [],
      isActive: client.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.masterClients.set(id, newClient);
    return newClient;
  }

  async updateMasterClient(id: string, client: Partial<InsertMasterClient>): Promise<MasterClient | undefined> {
    const existing = this.masterClients.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      ...client,
      updatedAt: new Date()
    };
    this.masterClients.set(id, updated);
    return updated;
  }

  async deleteMasterClient(id: string): Promise<boolean> {
    return this.masterClients.delete(id);
  }

  async mergeMasterClients(sourceId: string, targetId: string): Promise<boolean> {
    Array.from(this.userClientLinks.values()).forEach(link => {
      if (link.masterClientId === sourceId) {
        link.masterClientId = targetId;
      }
    });
    this.masterClients.delete(sourceId);
    return true;
  }

  // User Client Links (stub methods for MemStorage)
  async getUserClientLinks(userId: string): Promise<UserClientLink[]> {
    return Array.from(this.userClientLinks.values()).filter(
      link => link.userId === userId && link.isActive
    );
  }

  async getUserClientLink(userId: string, masterClientId: string): Promise<UserClientLink | undefined> {
    return Array.from(this.userClientLinks.values()).find(
      link => link.userId === userId && link.masterClientId === masterClientId
    );
  }

  async createUserClientLink(link: InsertUserClientLink): Promise<UserClientLink> {
    const id = randomUUID();
    const newLink: UserClientLink = { 
      ...link, 
      id,
      customName: link.customName ?? null,
      plantingArea: link.plantingArea ?? null,
      cultures: link.cultures ?? null,
      plantingProgress: link.plantingProgress ?? "0.00",
      isTop80_20: link.isTop80_20 ?? false,
      isActive: link.isActive ?? true,
      createdAt: new Date()
    };
    this.userClientLinks.set(id, newLink);
    return newLink;
  }

  async updateUserClientLink(id: string, link: Partial<InsertUserClientLink>): Promise<UserClientLink | undefined> {
    const existing = this.userClientLinks.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...link };
    this.userClientLinks.set(id, updated);
    return updated;
  }

  async deleteUserClientLink(id: string): Promise<boolean> {
    return this.userClientLinks.delete(id);
  }

  // Season methods
  async getAllSeasons(): Promise<Season[]> {
    return Array.from(this.seasons.values()).filter(s => s.isActive);
  }

  async getActiveSeason(): Promise<Season | undefined> {
    const now = new Date();
    return Array.from(this.seasons.values()).find(s => 
      s.isActive && now >= s.startDate && now <= s.endDate
    );
  }

  async createSeason(season: InsertSeason): Promise<Season> {
    const id = randomUUID();
    const newSeason: Season = { 
      ...season, 
      id,
      isActive: season.isActive ?? true
    };
    this.seasons.set(id, newSeason);
    return newSeason;
  }

  // Season Goal methods
  async getAllSeasonGoals(): Promise<SeasonGoal[]> {
    return Array.from(this.seasonGoals.values());
  }

  async getSeasonGoal(seasonId: string, userId: string): Promise<SeasonGoal | undefined> {
    return Array.from(this.seasonGoals.values()).find(g => 
      g.seasonId === seasonId && g.userId === userId
    );
  }

  async createSeasonGoal(goal: InsertSeasonGoal): Promise<SeasonGoal> {
    const id = randomUUID();
    const newGoal: SeasonGoal = { 
      ...goal, 
      id,
      metaAgroquimicos: goal.metaAgroquimicos ?? "0",
      metaEspecialidades: goal.metaEspecialidades ?? "0",
      metaSementesMilho: goal.metaSementesMilho ?? "0",
      metaSementesSoja: goal.metaSementesSoja ?? "0",
      metaSementesTrigo: goal.metaSementesTrigo ?? "0",
      metaSementesDiversas: goal.metaSementesDiversas ?? "0",
      metaFertilizantes: goal.metaFertilizantes ?? "0",
      metaCorretivos: goal.metaCorretivos ?? "0"
    };
    this.seasonGoals.set(id, newGoal);
    return newGoal;
  }

  async updateSeasonGoal(id: string, goal: Partial<InsertSeasonGoal>): Promise<SeasonGoal | undefined> {
    const existing = this.seasonGoals.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...goal };
    this.seasonGoals.set(id, updated);
    return updated;
  }

  // Sale methods
  async getAllSales(): Promise<Sale[]> {
    return Array.from(this.sales.values());
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return this.sales.get(id);
  }

  async getSalesByClient(clientId: string): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter(s => s.clientId === clientId);
  }

  async getSalesBySeason(seasonId: string): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter(s => s.seasonId === seasonId);
  }

  async getSaleByOrderCode(orderCode: string, userId: string): Promise<Sale | undefined> {
    return Array.from(this.sales.values()).find(s => s.orderCode === orderCode && s.userId === userId);
  }

  async getExistingOrderCodes(userId: string): Promise<Set<string>> {
    const orderCodes = new Set<string>();
    for (const sale of Array.from(this.sales.values())) {
      if (sale.userId === userId && sale.orderCode) {
        orderCodes.add(sale.orderCode);
      }
    }
    return orderCodes;
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    const now = new Date();
    const newSale: Sale = { 
      ...sale, 
      id, 
      createdAt: now,
      quantity: sale.quantity ?? null,
      timacPoints: sale.timacPoints ?? null,
      isManual: sale.isManual ?? false,
      pdfFileName: sale.pdfFileName ?? null,
      importBatchId: sale.importBatchId ?? null,
      orderCode: sale.orderCode ?? null
    };
    this.sales.set(id, newSale);
    return newSale;
  }

  async updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale | undefined> {
    const existing = this.sales.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...sale };
    this.sales.set(id, updated);
    return updated;
  }

  async getImportBatches(): Promise<Array<{
    batchId: string;
    importDate: Date;
    salesCount: number;
    totalAmount: number;
    totalCommissions: number;
    userId: string;
  }>> {
    const batches = new Map<string, {
      importDate: Date;
      sales: Sale[];
      userId: string;
    }>();

    for (const sale of Array.from(this.sales.values())) {
      if (sale.importBatchId) {
        const existing = batches.get(sale.importBatchId);
        if (existing) {
          existing.sales.push(sale);
          if (sale.createdAt < existing.importDate) {
            existing.importDate = sale.createdAt;
          }
        } else {
          batches.set(sale.importBatchId, {
            importDate: sale.createdAt,
            sales: [sale],
            userId: sale.userId
          });
        }
      }
    }

    return Array.from(batches.entries())
      .map(([batchId, data]) => ({
        batchId,
        importDate: data.importDate,
        salesCount: data.sales.length,
        totalAmount: data.sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0),
        totalCommissions: data.sales.reduce((sum, s) => sum + parseFloat(s.commissionAmount), 0),
        userId: data.userId
      }))
      .sort((a, b) => b.importDate.getTime() - a.importDate.getTime());
  }

  async deleteImportBatch(batchId: string): Promise<void> {
    for (const [id, sale] of Array.from(this.sales.entries())) {
      if (sale.importBatchId === batchId) {
        this.sales.delete(id);
      }
    }
  }

  // Season Parameter methods
  async getAllSeasonParameters(): Promise<SeasonParameter[]> {
    return Array.from(this.seasonParameters.values());
  }

  async createSeasonParameter(parameter: InsertSeasonParameter): Promise<SeasonParameter> {
    const id = randomUUID();
    const newParameter: SeasonParameter = { ...parameter, id };
    this.seasonParameters.set(id, newParameter);
    return newParameter;
  }

  // Market Investment Rates methods
  async getMarketInvestmentRates(): Promise<MarketInvestmentRate[]> {
    // MemStorage doesn't have this data, return empty array
    return [];
  }

  // Client Market Rates methods
  async getClientMarketRates(clientId: string, userId: string, seasonId: string): Promise<ClientMarketRate[]> {
    // MemStorage doesn't support this, return empty array
    return [];
  }

  async upsertClientMarketRate(rate: InsertClientMarketRate): Promise<ClientMarketRate> {
    // MemStorage doesn't support this
    const id = randomUUID();
    return { id, ...rate, createdAt: new Date(), updatedAt: new Date() } as ClientMarketRate;
  }

  async deleteClientMarketRate(clientId: string, categoryId: string, userId: string, seasonId: string): Promise<boolean> {
    // MemStorage doesn't support this
    return true;
  }

  // Client Market Values methods
  async getClientMarketValues(clientId: string, userId: string, seasonId: string): Promise<ClientMarketValue[]> {
    // MemStorage doesn't support this, return empty array
    return [];
  }

  async upsertClientMarketValue(value: InsertClientMarketValue): Promise<ClientMarketValue> {
    // MemStorage doesn't support this
    const id = randomUUID();
    return { id, ...value, createdAt: new Date(), updatedAt: new Date() } as ClientMarketValue;
  }

  async deleteClientMarketValue(clientId: string, categoryId: string, userId: string, seasonId: string): Promise<boolean> {
    // MemStorage doesn't support this
    return true;
  }

  // Analytics methods
  async getSalesAnalytics(seasonId?: string, userId?: string): Promise<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }> {
    let sales = Array.from(this.sales.values());
    if (seasonId) {
      sales = sales.filter(s => s.seasonId === seasonId);
    }
    if (userId) {
      sales = sales.filter(s => s.userId === userId);
    }

    const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
    const totalCommissions = sales.reduce((sum, s) => sum + parseFloat(s.commissionAmount), 0);

    // Sales by category
    const categoryMap = new Map<string, { total: number; commissions: number; name: string }>();
    for (const sale of sales) {
      const existing = categoryMap.get(sale.categoryId) || { total: 0, commissions: 0, name: "" };
      const category = this.categories.get(sale.categoryId);
      categoryMap.set(sale.categoryId, {
        total: existing.total + parseFloat(sale.totalAmount),
        commissions: existing.commissions + parseFloat(sale.commissionAmount),
        name: category?.name || "Unknown",
      });
    }

    const salesByCategory = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      total: data.total,
      commissions: data.commissions,
    }));

    // Top clients
    const clientMap = new Map<string, number>();
    for (const sale of sales) {
      const existing = clientMap.get(sale.clientId) || 0;
      clientMap.set(sale.clientId, existing + parseFloat(sale.totalAmount));
    }

    const topClients = Array.from(clientMap.entries())
      .map(([clientId, total]) => {
        const client = this.clients.get(clientId);
        return {
          clientId,
          clientName: client?.name || "Unknown",
          total,
          percentage: totalSales > 0 ? (total / totalSales) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      totalSales,
      totalCommissions,
      salesByCategory,
      topClients,
    };
  }

  async getMarketBenchmarks(userId: string, seasonId: string): Promise<MarketBenchmark[]> {
    return [];
  }

  async upsertMarketBenchmark(benchmark: InsertMarketBenchmark): Promise<MarketBenchmark> {
    const id = randomUUID();
    return { id, ...benchmark, createdAt: new Date(), updatedAt: new Date() } as MarketBenchmark;
  }

  async deleteMarketBenchmark(userId: string, categoryId: string, seasonId: string): Promise<boolean> {
    return true;
  }

  async getMarketPotentialByCategory(userId: string, seasonId: string): Promise<Array<{
    categoryId: string;
    categoryName: string;
    marketArea: number;
    investmentPerHa: number;
    totalPotential: number;
  }>> {
    return [];
  }

  async getExternalPurchases(clientId: string, userId: string, seasonId: string): Promise<ExternalPurchase[]> {
    return [];
  }

  async upsertExternalPurchase(purchase: InsertExternalPurchase): Promise<ExternalPurchase> {
    const id = randomUUID();
    return { id, ...purchase, createdAt: new Date(), updatedAt: new Date() } as ExternalPurchase;
  }

  async deleteExternalPurchase(userId: string, clientId: string, categoryId: string, seasonId: string): Promise<boolean> {
    return true;
  }

  // Client Family Relations
  async getClientFamilyRelations(clientId: string, userId: string): Promise<string[]> {
    return [];
  }

  async addClientFamilyRelation(relation: InsertClientFamilyRelation): Promise<ClientFamilyRelation> {
    const id = randomUUID();
    return { id, ...relation, createdAt: new Date() } as ClientFamilyRelation;
  }

  async removeClientFamilyRelation(clientId: string, relatedClientId: string, userId: string): Promise<boolean> {
    return true;
  }

  async getOpportunityAlerts(clientId?: string): Promise<{
    clientId: string;
    clientName: string;
    missingProducts: string[];
    category: string;
    region: string;
    severity: 'high' | 'medium' | 'low';
  }[]> {
    // This is a simplified implementation
    // In reality, this would compare current season vs previous season purchases
    return [];
  }

  // Alert Settings
  async getAlertSettings(userId: string): Promise<AlertSettings | undefined> {
    throw new Error("Not implemented in MemStorage");
  }

  async upsertAlertSettings(settings: InsertAlertSettings): Promise<AlertSettings> {
    throw new Error("Not implemented in MemStorage");
  }

  // Alerts
  async getAlerts(userId: string): Promise<Alert[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getUnreadAlertsCount(userId: string): Promise<number> {
    throw new Error("Not implemented in MemStorage");
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    throw new Error("Not implemented in MemStorage");
  }

  async markAlertAsRead(alertId: string, userId: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage");
  }

  async markAllAlertsAsRead(userId: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteAlert(alertId: string, userId: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage");
  }

  // Purchase History
  async getPurchaseHistories(userId: string, clientId?: string, seasonId?: string): Promise<PurchaseHistory[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async getPurchaseHistory(id: string, userId: string): Promise<PurchaseHistory | undefined> {
    throw new Error("Not implemented in MemStorage");
  }

  async createPurchaseHistory(history: InsertPurchaseHistory): Promise<PurchaseHistory> {
    throw new Error("Not implemented in MemStorage");
  }

  async deletePurchaseHistory(id: string, userId: string): Promise<boolean> {
    throw new Error("Not implemented in MemStorage");
  }

  async getPurchaseHistoryItems(purchaseHistoryId: string): Promise<PurchaseHistoryItem[]> {
    throw new Error("Not implemented in MemStorage");
  }

  async createPurchaseHistoryItem(item: InsertPurchaseHistoryItem): Promise<PurchaseHistoryItem> {
    throw new Error("Not implemented in MemStorage");
  }

  // Barter Module
  async getAllBarterProducts(): Promise<BarterProduct[]> {
    return Array.from(this.barterProducts.values()).filter(p => p.isActive);
  }

  async createBarterProduct(product: InsertBarterProduct): Promise<BarterProduct> {
    const id = randomUUID();
    const now = new Date();
    const newProduct: BarterProduct = { 
      ...product, 
      id, 
      createdAt: now, 
      updatedAt: now,
      isActive: product.isActive ?? true
    };
    this.barterProducts.set(id, newProduct);
    return newProduct;
  }

  async updateBarterProduct(id: string, product: Partial<InsertBarterProduct>): Promise<BarterProduct | undefined> {
    const existing = this.barterProducts.get(id);
    if (!existing) return undefined;
    const updated: BarterProduct = { ...existing, ...product, updatedAt: new Date() };
    this.barterProducts.set(id, updated);
    return updated;
  }

  async deleteBarterProduct(id: string): Promise<boolean> {
    return this.barterProducts.delete(id);
  }

  async deleteAllBarterProducts(): Promise<void> {
    this.barterProducts.clear();
  }

  async getAllBarterSettings(): Promise<BarterSettings[]> {
    return Array.from(this.barterSettings.values());
  }

  async upsertBarterSetting(key: string, value: string, description?: string): Promise<BarterSettings> {
    const existing = Array.from(this.barterSettings.values()).find(s => s.key === key);
    const setting: BarterSettings = existing 
      ? { ...existing, value, description: description || existing.description, updatedAt: new Date() }
      : { id: randomUUID(), key, value, description: description || null, updatedAt: new Date() };
    
    if (existing) {
      this.barterSettings.set(existing.id, setting);
    } else {
      this.barterSettings.set(setting.id, setting);
    }
    return setting;
  }

  async getBarterSimulationsByUser(userId: string): Promise<BarterSimulation[]> {
    return Array.from(this.barterSimulations.values()).filter(s => s.userId === userId);
  }

  async getBarterSimulation(id: string): Promise<BarterSimulation | undefined> {
    return this.barterSimulations.get(id);
  }

  async createBarterSimulation(simulation: InsertBarterSimulation, items: InsertBarterSimulationItem[]): Promise<BarterSimulation> {
    const id = randomUUID();
    const now = new Date();
    const newSimulation: BarterSimulation = { 
      ...simulation, 
      id, 
      createdAt: now, 
      updatedAt: now,
      status: simulation.status || "draft"
    };
    this.barterSimulations.set(id, newSimulation);
    return newSimulation;
  }

  async updateBarterSimulation(id: string, simulation: Partial<InsertBarterSimulation>): Promise<BarterSimulation | undefined> {
    const existing = this.barterSimulations.get(id);
    if (!existing) return undefined;
    const updated: BarterSimulation = { ...existing, ...simulation, updatedAt: new Date() };
    this.barterSimulations.set(id, updated);
    return updated;
  }

  async deleteBarterSimulation(id: string): Promise<boolean> {
    return this.barterSimulations.delete(id);
  }

  // Sales Targets - Stubs for in-memory storage
  async getKanbanData(userId: string, seasonId: string): Promise<any> {
    return { clients: [] };
  }

  async getSalesTargets(userId: string, seasonId?: string): Promise<any[]> {
    return [];
  }

  async createSalesTarget(userId: string, clientId: string, segmento: string, valorCapturado: number, seasonId: string, subcategories?: Record<string, number>): Promise<any> {
    return { id: randomUUID(), userId, clientId, segmento, valorCapturado: valorCapturado.toString(), seasonId, subcategories, createdAt: new Date(), updatedAt: new Date() };
  }

  async updateSalesTarget(id: string, valorCapturado: number, subcategories?: Record<string, number>): Promise<any> {
    return { id, valorCapturado: valorCapturado.toString(), subcategories, updatedAt: new Date() };
  }

  async deleteSalesTarget(id: string, userId: string): Promise<boolean> {
    return true;
  }

  async getSystemSettings(): Promise<{ allowUserRegistration: boolean } | undefined> {
    // MemStorage doesn't persist system settings - always allow registration in memory mode
    return { allowUserRegistration: true };
  }
}

export class DBStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool: pool as any, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await db.insert(users).values({
      id,
      ...user,
      role: user.role ?? "vendedor"
    }).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const result = await db.insert(categories).values({
      id,
      ...category,
      defaultIva: category.defaultIva ?? "10.00"
    }).returning();
    return result[0];
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return result[0];
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.isActive, true));
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return await db.select().from(products).where(
      and(eq(products.categoryId, categoryId), eq(products.isActive, true))
    );
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const result = await db.insert(products).values({
      id,
      ...product,
      description: product.description ?? null,
      isActive: product.isActive ?? true
    }).returning();
    return result[0];
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async getAllRegions(): Promise<Region[]> {
    return await db.select().from(regions);
  }

  async createRegion(region: InsertRegion): Promise<Region> {
    const id = randomUUID();
    const result = await db.insert(regions).values({
      id,
      ...region,
      country: region.country ?? "Paraguay"
    }).returning();
    return result[0];
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.isActive, true));
  }

  async getClient(id: string): Promise<Client | undefined> {
    // Buscar em user_client_links com join para master_clients
    const links = await db.select({
      linkId: userClientLinks.id,
      masterClientId: userClientLinks.masterClientId,
      customName: userClientLinks.customName,
      linkPlantingArea: userClientLinks.plantingArea,
      linkCultures: userClientLinks.cultures,
      plantingProgress: userClientLinks.plantingProgress,
      isTop80_20: userClientLinks.isTop80_20,
      includeInMarketArea: userClientLinks.includeInMarketArea,
      isActive: userClientLinks.isActive,
      userId: userClientLinks.userId,
      masterName: masterClients.name,
      regionId: masterClients.regionId,
      masterPlantingArea: masterClients.plantingArea,
      masterCultures: masterClients.cultures
    })
    .from(userClientLinks)
    .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
    .where(eq(userClientLinks.id, id));
    
    if (links.length === 0) return undefined;
    
    const link = links[0];
    return {
      id: link.linkId,
      name: link.customName || link.masterName,
      regionId: link.regionId || '',
      plantingArea: link.linkPlantingArea || link.masterPlantingArea || '0',
      cultures: link.linkCultures || link.masterCultures || [],
      plantingProgress: link.plantingProgress || '0.00',
      isTop80_20: link.isTop80_20,
      includeInMarketArea: link.includeInMarketArea,
      isActive: link.isActive,
      userId: link.userId
    };
  }

  async getTop80_20Clients(): Promise<Client[]> {
    return await db.select().from(clients).where(
      and(eq(clients.isTop80_20, true), eq(clients.isActive, true))
    );
  }

  async createClient(client: InsertClient): Promise<Client> {
    // 1. Buscar ou criar master_client
    let masterClient = await this.findMasterClientByName(client.name);
    
    if (!masterClient) {
      // Criar novo master_client
      masterClient = await this.createMasterClient({
        name: client.name,
        regionId: client.regionId || null,
        plantingArea: client.plantingArea || null,
        cultures: client.cultures || [],
        isActive: true
      });
    }
    
    // 2. Criar user_client_link
    const linkId = randomUUID();
    const newLink = await db.insert(userClientLinks).values({
      id: linkId,
      userId: client.userId!,
      masterClientId: masterClient.id,
      customName: null, // Usar nome do master_client
      plantingArea: client.plantingArea || null,
      cultures: client.cultures || null,
      plantingProgress: client.plantingProgress ?? "0.00",
      isTop80_20: client.isTop80_20 ?? false,
      includeInMarketArea: client.includeInMarketArea ?? false,
      isActive: true
    }).returning();
    
    // 3. Retornar no formato Client
    return {
      id: linkId,
      name: masterClient.name,
      regionId: masterClient.regionId || '',
      plantingArea: client.plantingArea || masterClient.plantingArea || '0',
      cultures: client.cultures || masterClient.cultures || [],
      plantingProgress: client.plantingProgress ?? '0.00',
      isTop80_20: client.isTop80_20 ?? false,
      includeInMarketArea: client.includeInMarketArea ?? false,
      isActive: true,
      userId: client.userId!
    };
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    // Atualizar user_client_links
    const updateData: Partial<typeof userClientLinks.$inferInsert> = {};
    
    if (client.name !== undefined) updateData.customName = client.name;
    if (client.plantingArea !== undefined) updateData.plantingArea = client.plantingArea;
    if (client.cultures !== undefined) updateData.cultures = client.cultures;
    if (client.plantingProgress !== undefined) updateData.plantingProgress = client.plantingProgress;
    if (client.isTop80_20 !== undefined) updateData.isTop80_20 = client.isTop80_20;
    if (client.includeInMarketArea !== undefined) updateData.includeInMarketArea = client.includeInMarketArea;
    if (client.isActive !== undefined) updateData.isActive = client.isActive;
    
    await db.update(userClientLinks)
      .set(updateData)
      .where(eq(userClientLinks.id, id));
    
    return await this.getClient(id);
  }

  async deleteClient(id: string): Promise<boolean> {
    // Deletar user_client_link
    const result = await db.delete(userClientLinks)
      .where(eq(userClientLinks.id, id))
      .returning();
    return result.length > 0;
  }

  async getClientsForUser(userId: string, top8020Only?: boolean): Promise<Client[]> {
    const links = await db.select({
      linkId: userClientLinks.id,
      masterClientId: userClientLinks.masterClientId,
      customName: userClientLinks.customName,
      linkPlantingArea: userClientLinks.plantingArea,
      linkCultures: userClientLinks.cultures,
      plantingProgress: userClientLinks.plantingProgress,
      isTop80_20: userClientLinks.isTop80_20,
      includeInMarketArea: userClientLinks.includeInMarketArea,
      isActive: userClientLinks.isActive,
      masterName: masterClients.name,
      regionId: masterClients.regionId,
      masterPlantingArea: masterClients.plantingArea,
      masterCultures: masterClients.cultures
    })
    .from(userClientLinks)
    .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
    .where(
      and(
        eq(userClientLinks.userId, userId),
        eq(userClientLinks.isActive, true),
        eq(masterClients.isActive, true),
        top8020Only ? eq(userClientLinks.isTop80_20, true) : sql`true`
      )
    );

    // Mapear para formato Client
    return links.map(link => ({
      id: link.linkId,
      name: link.customName || link.masterName,
      regionId: link.regionId || '',
      plantingArea: link.linkPlantingArea || link.masterPlantingArea || '0',
      cultures: link.linkCultures || link.masterCultures || [],
      plantingProgress: link.plantingProgress || '0.00',
      isTop80_20: link.isTop80_20,
      includeInMarketArea: link.includeInMarketArea,
      isActive: link.isActive,
      userId: userId
    }));
  }

  // Master Clients
  async getAllMasterClients(): Promise<MasterClient[]> {
    return await db.select().from(masterClients).where(eq(masterClients.isActive, true)).orderBy(asc(masterClients.name));
  }

  async getMasterClient(id: string): Promise<MasterClient | undefined> {
    const result = await db.select().from(masterClients).where(eq(masterClients.id, id));
    return result[0];
  }

  async findMasterClientByName(name: string): Promise<MasterClient | undefined> {
    const normalizedSearch = name.toUpperCase().trim().replace(/[.,\-\s]/g, '');
    const allClients = await db.select().from(masterClients).where(eq(masterClients.isActive, true));
    
    return allClients.find(client => {
      const normalizedClientName = client.name.toUpperCase().trim().replace(/[.,\-\s]/g, '');
      return normalizedClientName === normalizedSearch;
    });
  }

  async createMasterClient(client: InsertMasterClient): Promise<MasterClient> {
    const id = randomUUID();
    const result = await db.insert(masterClients).values({
      id,
      ...client,
      cultures: client.cultures ?? [],
      isActive: client.isActive ?? true
    }).returning();
    return result[0];
  }

  async updateMasterClient(id: string, client: Partial<InsertMasterClient>): Promise<MasterClient | undefined> {
    const result = await db.update(masterClients)
      .set({
        ...client,
        updatedAt: new Date()
      })
      .where(eq(masterClients.id, id))
      .returning();
    return result[0];
  }

  async deleteMasterClient(id: string): Promise<boolean> {
    const result = await db.delete(masterClients)
      .where(eq(masterClients.id, id))
      .returning();
    return result.length > 0;
  }

  async mergeMasterClients(sourceId: string, targetId: string): Promise<boolean> {
    await db.update(userClientLinks)
      .set({ masterClientId: targetId })
      .where(eq(userClientLinks.masterClientId, sourceId));
    
    await db.delete(masterClients).where(eq(masterClients.id, sourceId));
    return true;
  }

  // User Client Links
  async getUserClientLinks(userId: string): Promise<UserClientLink[]> {
    return await db.select().from(userClientLinks).where(
      and(eq(userClientLinks.userId, userId), eq(userClientLinks.isActive, true))
    );
  }

  async getUserClientLink(userId: string, masterClientId: string): Promise<UserClientLink | undefined> {
    const result = await db.select().from(userClientLinks).where(
      and(
        eq(userClientLinks.userId, userId),
        eq(userClientLinks.masterClientId, masterClientId)
      )
    );
    return result[0];
  }

  async createUserClientLink(link: InsertUserClientLink): Promise<UserClientLink> {
    const id = randomUUID();
    const result = await db.insert(userClientLinks).values({
      id,
      ...link,
      plantingProgress: link.plantingProgress ?? "0.00",
      isTop80_20: link.isTop80_20 ?? false,
      isActive: link.isActive ?? true
    }).returning();
    return result[0];
  }

  async updateUserClientLink(id: string, link: Partial<InsertUserClientLink>): Promise<UserClientLink | undefined> {
    const result = await db.update(userClientLinks)
      .set(link)
      .where(eq(userClientLinks.id, id))
      .returning();
    return result[0];
  }

  async deleteUserClientLink(id: string): Promise<boolean> {
    const result = await db.delete(userClientLinks)
      .where(eq(userClientLinks.id, id))
      .returning();
    return result.length > 0;
  }

  async getAllSeasons(): Promise<Season[]> {
    return await db.select().from(seasons).where(eq(seasons.isActive, true));
  }

  async getActiveSeason(): Promise<Season | undefined> {
    const now = new Date();
    const result = await db.select().from(seasons).where(
      and(
        eq(seasons.isActive, true),
        sql`${seasons.startDate} <= ${now}`,
        sql`${seasons.endDate} >= ${now}`
      )
    );
    return result[0];
  }

  async createSeason(season: InsertSeason): Promise<Season> {
    const id = randomUUID();
    const result = await db.insert(seasons).values({
      id,
      ...season,
      isActive: season.isActive ?? true
    }).returning();
    return result[0];
  }

  async getAllSeasonGoals(): Promise<SeasonGoal[]> {
    return await db.select().from(seasonGoals);
  }

  async getSeasonGoal(seasonId: string, userId: string): Promise<SeasonGoal | undefined> {
    const result = await db.select().from(seasonGoals).where(
      and(eq(seasonGoals.seasonId, seasonId), eq(seasonGoals.userId, userId))
    );
    return result[0];
  }

  async createSeasonGoal(goal: InsertSeasonGoal): Promise<SeasonGoal> {
    const id = randomUUID();
    const result = await db.insert(seasonGoals).values({
      id,
      ...goal
    }).returning();
    return result[0];
  }

  async updateSeasonGoal(id: string, goal: Partial<InsertSeasonGoal>): Promise<SeasonGoal | undefined> {
    const result = await db.update(seasonGoals)
      .set(goal)
      .where(eq(seasonGoals.id, id))
      .returning();
    return result[0];
  }

  async deleteSeasonGoal(id: string): Promise<boolean> {
    const result = await db.delete(seasonGoals)
      .where(eq(seasonGoals.id, id))
      .returning();
    return result.length > 0;
  }

  async getAllSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const result = await db.select().from(sales).where(eq(sales.id, id));
    return result[0];
  }

  async getSalesByClient(clientId: string): Promise<Sale[]> {
    return await db.select().from(sales)
      .where(eq(sales.clientId, clientId))
      .orderBy(desc(sales.createdAt));
  }

  async getSalesBySeason(seasonId: string): Promise<Sale[]> {
    return await db.select().from(sales)
      .where(eq(sales.seasonId, seasonId))
      .orderBy(desc(sales.createdAt));
  }

  async getSaleByOrderCode(orderCode: string, userId: string): Promise<Sale | undefined> {
    const result = await db.select().from(sales)
      .where(and(
        eq(sales.orderCode, orderCode),
        eq(sales.userId, userId)
      ))
      .limit(1);
    return result[0];
  }

  async getExistingOrderCodes(userId: string): Promise<Set<string>> {
    const result = await db
      .selectDistinct({ orderCode: sales.orderCode })
      .from(sales)
      .where(and(
        eq(sales.userId, userId),
        sql`${sales.orderCode} IS NOT NULL`
      ));
    
    return new Set(result.map(r => r.orderCode).filter((code): code is string => code !== null));
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    const now = new Date();
    const result = await db.insert(sales).values({
      id,
      ...sale,
      createdAt: now,
      isManual: sale.isManual ?? false,
      pdfFileName: sale.pdfFileName ?? null
    }).returning();
    return result[0];
  }

  async updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale | undefined> {
    const result = await db.update(sales)
      .set(sale)
      .where(eq(sales.id, id))
      .returning();
    return result[0];
  }

  async getImportBatches(): Promise<Array<{
    batchId: string;
    importDate: Date;
    salesCount: number;
    totalAmount: number;
    totalCommissions: number;
    userId: string;
  }>> {
    const result = await db
      .select({
        batchId: sales.importBatchId,
        importDate: sql<Date>`MIN(${sales.createdAt})`,
        salesCount: sql<number>`COUNT(*)::int`,
        totalAmount: sql<number>`SUM(CAST(${sales.totalAmount} AS NUMERIC))`,
        totalCommissions: sql<number>`SUM(CAST(${sales.commissionAmount} AS NUMERIC))`,
        userId: sql<string>`MIN(${sales.userId})`,
      })
      .from(sales)
      .where(sql`${sales.importBatchId} IS NOT NULL`)
      .groupBy(sales.importBatchId)
      .orderBy(sql`MIN(${sales.createdAt}) DESC`);
    
    return result.map(row => ({
      batchId: row.batchId!,
      importDate: row.importDate,
      salesCount: row.salesCount,
      totalAmount: Number(row.totalAmount),
      totalCommissions: Number(row.totalCommissions),
      userId: row.userId,
    }));
  }

  async deleteImportBatch(batchId: string): Promise<void> {
    await db.delete(sales).where(eq(sales.importBatchId, batchId));
  }

  async deleteAllSales(): Promise<void> {
    await db.delete(sales);
  }

  async getAllSeasonParameters(): Promise<SeasonParameter[]> {
    return await db.select().from(seasonParameters);
  }

  async createSeasonParameter(parameter: InsertSeasonParameter): Promise<SeasonParameter> {
    const id = randomUUID();
    const result = await db.insert(seasonParameters).values({
      id,
      ...parameter
    }).returning();
    return result[0];
  }

  async getMarketInvestmentRates(): Promise<MarketInvestmentRate[]> {
    return await db.select().from(marketInvestmentRates);
  }

  async getClientMarketRates(clientId: string, userId: string, seasonId: string): Promise<ClientMarketRate[]> {
    return await db.select().from(clientMarketRates)
      .where(and(
        eq(clientMarketRates.clientId, clientId), 
        eq(clientMarketRates.userId, userId),
        eq(clientMarketRates.seasonId, seasonId)
      ));
  }

  async upsertClientMarketRate(rate: InsertClientMarketRate): Promise<ClientMarketRate> {
    const existing = await db.select().from(clientMarketRates)
      .where(and(
        eq(clientMarketRates.clientId, rate.clientId),
        eq(clientMarketRates.categoryId, rate.categoryId),
        eq(clientMarketRates.userId, rate.userId),
        eq(clientMarketRates.seasonId, rate.seasonId)
      ))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db.update(clientMarketRates)
        .set({
          investmentPerHa: rate.investmentPerHa,
          subcategories: rate.subcategories,
          updatedAt: sql`now()`
        })
        .where(eq(clientMarketRates.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const id = randomUUID();
      const inserted = await db.insert(clientMarketRates)
        .values({ id, ...rate })
        .returning();
      return inserted[0];
    }
  }

  async deleteClientMarketRate(clientId: string, categoryId: string, userId: string, seasonId: string): Promise<boolean> {
    await db.delete(clientMarketRates)
      .where(and(
        eq(clientMarketRates.clientId, clientId),
        eq(clientMarketRates.categoryId, categoryId),
        eq(clientMarketRates.userId, userId),
        eq(clientMarketRates.seasonId, seasonId)
      ));
    return true;
  }

  async getClientMarketValues(clientId: string, userId: string, seasonId: string): Promise<ClientMarketValue[]> {
    return await db.select().from(clientMarketValues)
      .where(and(
        eq(clientMarketValues.clientId, clientId), 
        eq(clientMarketValues.userId, userId),
        eq(clientMarketValues.seasonId, seasonId)
      ));
  }

  async upsertClientMarketValue(value: InsertClientMarketValue): Promise<ClientMarketValue> {
    const existing = await db.select().from(clientMarketValues)
      .where(and(
        eq(clientMarketValues.clientId, value.clientId),
        eq(clientMarketValues.categoryId, value.categoryId),
        eq(clientMarketValues.userId, value.userId),
        eq(clientMarketValues.seasonId, value.seasonId)
      ))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db.update(clientMarketValues)
        .set({
          marketValue: value.marketValue,
          subcategories: value.subcategories,
          updatedAt: sql`now()`
        })
        .where(eq(clientMarketValues.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const id = randomUUID();
      const inserted = await db.insert(clientMarketValues)
        .values({ id, ...value })
        .returning();
      return inserted[0];
    }
  }

  async deleteClientMarketValue(clientId: string, categoryId: string, userId: string, seasonId: string): Promise<boolean> {
    await db.delete(clientMarketValues)
      .where(and(
        eq(clientMarketValues.clientId, clientId),
        eq(clientMarketValues.categoryId, categoryId),
        eq(clientMarketValues.userId, userId),
        eq(clientMarketValues.seasonId, seasonId)
      ));
    return true;
  }

  async getMarketBenchmarks(userId: string, seasonId: string): Promise<MarketBenchmark[]> {
    return await db.select().from(marketBenchmarks)
      .where(and(
        eq(marketBenchmarks.userId, userId),
        eq(marketBenchmarks.seasonId, seasonId)
      ));
  }

  async upsertMarketBenchmark(benchmark: InsertMarketBenchmark): Promise<MarketBenchmark> {
    const existing = await db.select().from(marketBenchmarks)
      .where(and(
        eq(marketBenchmarks.userId, benchmark.userId),
        eq(marketBenchmarks.categoryId, benchmark.categoryId),
        eq(marketBenchmarks.seasonId, benchmark.seasonId)
      ))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db.update(marketBenchmarks)
        .set({
          marketPercentage: benchmark.marketPercentage,
          updatedAt: sql`now()`
        })
        .where(eq(marketBenchmarks.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const id = randomUUID();
      const inserted = await db.insert(marketBenchmarks)
        .values({ id, ...benchmark })
        .returning();
      return inserted[0];
    }
  }

  async deleteMarketBenchmark(userId: string, categoryId: string, seasonId: string): Promise<boolean> {
    await db.delete(marketBenchmarks)
      .where(and(
        eq(marketBenchmarks.userId, userId),
        eq(marketBenchmarks.categoryId, categoryId),
        eq(marketBenchmarks.seasonId, seasonId)
      ));
    return true;
  }

  async getMarketPotentialByCategory(userId: string, seasonId: string): Promise<Array<{
    categoryId: string;
    categoryName: string;
    marketArea: number;
    investmentPerHa: number;
    totalPotential: number;
  }>> {
    // Get all clients with includeInMarketArea = true for this user
    const marketClients = await db.select({
      id: userClientLinks.id,
      plantingArea: userClientLinks.plantingArea,
      includeInMarketArea: userClientLinks.includeInMarketArea,
    })
    .from(userClientLinks)
    .where(and(
      eq(userClientLinks.userId, userId),
      eq(userClientLinks.includeInMarketArea, true)
    ));

    // Calculate total market area
    const totalMarketArea = marketClients.reduce((sum, client) => {
      return sum + parseFloat(client.plantingArea || '0');
    }, 0);

    // Get all categories
    const allCategories = await db.select().from(categories);

    // Get investment rates for this user and season - use DISTINCT ON to get one value per category
    const rates = await db.select({
      categoryId: clientMarketRates.categoryId,
      investmentPerHa: clientMarketRates.investmentPerHa,
    })
      .from(clientMarketRates)
      .where(and(
        eq(clientMarketRates.userId, userId),
        eq(clientMarketRates.seasonId, seasonId)
      ))
      .orderBy(clientMarketRates.categoryId, sql`${clientMarketRates.updatedAt} DESC`);

    // Use Map to store only the first (most recent) value per category
    const ratesByCategory = new Map<string, number>();
    for (const rate of rates) {
      if (!ratesByCategory.has(rate.categoryId)) {
        ratesByCategory.set(rate.categoryId, parseFloat(rate.investmentPerHa));
      }
    }

    // Build result array
    const result = allCategories.map(category => {
      const investmentPerHa = ratesByCategory.get(category.id) || 0;

      return {
        categoryId: category.id,
        categoryName: category.name,
        marketArea: totalMarketArea,
        investmentPerHa: investmentPerHa,
        totalPotential: totalMarketArea * investmentPerHa,
      };
    });

    return result;
  }

  // External Purchases
  async getExternalPurchases(clientId: string, userId: string, seasonId: string): Promise<ExternalPurchase[]> {
    return await db.select().from(externalPurchases)
      .where(and(
        eq(externalPurchases.clientId, clientId),
        eq(externalPurchases.userId, userId),
        eq(externalPurchases.seasonId, seasonId)
      ));
  }

  async upsertExternalPurchase(purchase: InsertExternalPurchase): Promise<ExternalPurchase> {
    const existing = await db.select().from(externalPurchases)
      .where(and(
        eq(externalPurchases.userId, purchase.userId),
        eq(externalPurchases.clientId, purchase.clientId),
        eq(externalPurchases.categoryId, purchase.categoryId),
        eq(externalPurchases.seasonId, purchase.seasonId)
      ))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db.update(externalPurchases)
        .set({
          amount: purchase.amount,
          subcategories: purchase.subcategories,
          updatedAt: sql`now()`
        })
        .where(eq(externalPurchases.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const id = randomUUID();
      const inserted = await db.insert(externalPurchases)
        .values({ id, ...purchase })
        .returning();
      return inserted[0];
    }
  }

  async deleteExternalPurchase(userId: string, clientId: string, categoryId: string, seasonId: string): Promise<boolean> {
    await db.delete(externalPurchases)
      .where(and(
        eq(externalPurchases.userId, userId),
        eq(externalPurchases.clientId, clientId),
        eq(externalPurchases.categoryId, categoryId),
        eq(externalPurchases.seasonId, seasonId)
      ));
    return true;
  }

  // Client Family Relations
  async getClientFamilyRelations(clientId: string, userId: string): Promise<string[]> {
    const relations = await db.select().from(clientFamilyRelations)
      .where(and(
        eq(clientFamilyRelations.clientId, clientId),
        eq(clientFamilyRelations.userId, userId)
      ));
    return relations.map(r => r.relatedClientId);
  }

  async getBatchClientFamilyRelations(clientIds: string[], userId: string): Promise<Map<string, string[]>> {
    if (clientIds.length === 0) {
      return new Map();
    }

    // Fetch all relations for these clients in a single query
    const relations = await db.select().from(clientFamilyRelations)
      .where(and(
        inArray(clientFamilyRelations.clientId, clientIds),
        eq(clientFamilyRelations.userId, userId)
      ));

    // Group by clientId
    const resultMap = new Map<string, string[]>();
    for (const clientId of clientIds) {
      resultMap.set(clientId, []);
    }

    for (const relation of relations) {
      const existing = resultMap.get(relation.clientId) || [];
      existing.push(relation.relatedClientId);
      resultMap.set(relation.clientId, existing);
    }

    return resultMap;
  }

  async addClientFamilyRelation(relation: InsertClientFamilyRelation): Promise<ClientFamilyRelation> {
    const id = randomUUID();
    const inverseId = randomUUID();
    
    // Check if relation already exists to prevent duplicates
    const existing = await db.select().from(clientFamilyRelations)
      .where(and(
        eq(clientFamilyRelations.clientId, relation.clientId),
        eq(clientFamilyRelations.relatedClientId, relation.relatedClientId),
        eq(clientFamilyRelations.userId, relation.userId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Add main relation (A → B)
    const inserted = await db.insert(clientFamilyRelations)
      .values({ id, ...relation })
      .returning();
    
    // Add inverse relation (B → A)
    await db.insert(clientFamilyRelations)
      .values({ 
        id: inverseId,
        clientId: relation.relatedClientId,
        relatedClientId: relation.clientId,
        userId: relation.userId
      });
    
    return inserted[0];
  }

  async removeClientFamilyRelation(clientId: string, relatedClientId: string, userId: string): Promise<boolean> {
    // Remove relation A → B
    await db.delete(clientFamilyRelations)
      .where(and(
        eq(clientFamilyRelations.clientId, clientId),
        eq(clientFamilyRelations.relatedClientId, relatedClientId),
        eq(clientFamilyRelations.userId, userId)
      ));
    
    // Remove inverse relation B → A
    await db.delete(clientFamilyRelations)
      .where(and(
        eq(clientFamilyRelations.clientId, relatedClientId),
        eq(clientFamilyRelations.relatedClientId, clientId),
        eq(clientFamilyRelations.userId, userId)
      ));
    
    return true;
  }

  async getSalesAnalytics(seasonId?: string, userId?: string): Promise<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }> {
    let salesData: Sale[];
    if (seasonId && userId) {
      salesData = await db.select().from(sales)
        .where(and(eq(sales.seasonId, seasonId), eq(sales.userId, userId)));
    } else if (seasonId) {
      salesData = await db.select().from(sales).where(eq(sales.seasonId, seasonId));
    } else if (userId) {
      salesData = await db.select().from(sales).where(eq(sales.userId, userId));
    } else {
      salesData = await db.select().from(sales);
    }

    const totalSales = salesData.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
    const totalCommissions = salesData.reduce((sum, s) => sum + parseFloat(s.commissionAmount), 0);

    // Batch fetch only the categories needed (no N+1 queries)
    const categoryIds = [...new Set(salesData.map(s => s.categoryId))];
    const neededCategories = categoryIds.length > 0 
      ? await db.select().from(categories).where(inArray(categories.id, categoryIds))
      : [];
    const categoryLookup = new Map(neededCategories.map(c => [c.id, c]));

    const categoryMap = new Map<string, { total: number; commissions: number; name: string }>();
    for (const sale of salesData) {
      const existing = categoryMap.get(sale.categoryId) || { total: 0, commissions: 0, name: "" };
      const category = categoryLookup.get(sale.categoryId);
      categoryMap.set(sale.categoryId, {
        total: existing.total + parseFloat(sale.totalAmount),
        commissions: existing.commissions + parseFloat(sale.commissionAmount),
        name: category?.name || "Unknown",
      });
    }

    const salesByCategory = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      total: data.total,
      commissions: data.commissions,
    }));

    // Batch fetch only the clients needed (no N+1 queries)
    const clientMap = new Map<string, number>();
    for (const sale of salesData) {
      const existing = clientMap.get(sale.clientId) || 0;
      clientMap.set(sale.clientId, existing + parseFloat(sale.totalAmount));
    }

    const clientIds = Array.from(clientMap.keys());
    const neededClientLinks = clientIds.length > 0 
      ? await db.select({
          id: userClientLinks.id,
          name: sql<string>`COALESCE(${userClientLinks.customName}, ${masterClients.name})`.as('name')
        })
        .from(userClientLinks)
        .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(inArray(userClientLinks.id, clientIds))
      : [];
    const clientLookup = new Map(neededClientLinks.map(c => [c.id, c.name || "Unknown"]));

    const topClients = Array.from(clientMap.entries())
      .map(([clientId, total]) => {
        const clientName = clientLookup.get(clientId) || "Unknown";
        return {
          clientId,
          clientName,
          total,
          percentage: totalSales > 0 ? (total / totalSales) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      totalSales,
      totalCommissions,
      salesByCategory,
      topClients,
    };
  }

  async getOpportunityAlerts(clientId?: string): Promise<{
    clientId: string;
    clientName: string;
    missingProducts: string[];
    category: string;
    region: string;
    severity: 'high' | 'medium' | 'low';
  }[]> {
    return [];
  }

  async getAlertSettings(userId: string): Promise<AlertSettings | undefined> {
    const result = await db.select().from(alertSettings)
      .where(eq(alertSettings.userId, userId));
    return result[0];
  }

  async upsertAlertSettings(settings: InsertAlertSettings): Promise<AlertSettings> {
    const existing = await this.getAlertSettings(settings.userId);
    
    if (existing) {
      const updated = await db.update(alertSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(alertSettings.userId, settings.userId))
        .returning();
      return updated[0];
    } else {
      const id = randomUUID();
      const inserted = await db.insert(alertSettings)
        .values({ id, ...settings })
        .returning();
      return inserted[0];
    }
  }

  async getAlerts(userId: string): Promise<Alert[]> {
    return await db.select().from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async getUnreadAlertsCount(userId: string): Promise<number> {
    const result = await db.select().from(alerts)
      .where(and(
        eq(alerts.userId, userId),
        eq(alerts.isRead, false)
      ));
    return result.length;
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const inserted = await db.insert(alerts)
      .values({ id, ...alert })
      .returning();
    return inserted[0];
  }

  async markAlertAsRead(alertId: string, userId: string): Promise<boolean> {
    await db.update(alerts)
      .set({ isRead: true })
      .where(and(
        eq(alerts.id, alertId),
        eq(alerts.userId, userId)
      ));
    return true;
  }

  async markAllAlertsAsRead(userId: string): Promise<boolean> {
    await db.update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.userId, userId));
    return true;
  }

  async deleteAlert(alertId: string, userId: string): Promise<boolean> {
    await db.delete(alerts)
      .where(and(
        eq(alerts.id, alertId),
        eq(alerts.userId, userId)
      ));
    return true;
  }

  // Purchase History
  async getPurchaseHistories(userId: string, clientId?: string, seasonId?: string): Promise<PurchaseHistory[]> {
    const conditions = [eq(purchaseHistory.userId, userId)];
    if (clientId) conditions.push(eq(purchaseHistory.clientId, clientId));
    if (seasonId) conditions.push(eq(purchaseHistory.seasonId, seasonId));
    
    return await db.select().from(purchaseHistory)
      .where(and(...conditions))
      .orderBy(desc(purchaseHistory.importDate));
  }

  async getPurchaseHistory(id: string, userId: string): Promise<PurchaseHistory | undefined> {
    const result = await db.select().from(purchaseHistory)
      .where(and(
        eq(purchaseHistory.id, id),
        eq(purchaseHistory.userId, userId)
      ))
      .limit(1);
    return result[0];
  }

  async createPurchaseHistory(history: InsertPurchaseHistory): Promise<PurchaseHistory> {
    const id = randomUUID();
    const inserted = await db.insert(purchaseHistory)
      .values({ id, ...history })
      .returning();
    return inserted[0];
  }

  async deletePurchaseHistory(id: string, userId: string): Promise<boolean> {
    await db.delete(purchaseHistory)
      .where(and(
        eq(purchaseHistory.id, id),
        eq(purchaseHistory.userId, userId)
      ));
    return true;
  }

  async getPurchaseHistoryItems(purchaseHistoryId: string): Promise<PurchaseHistoryItem[]> {
    return await db.select().from(purchaseHistoryItems)
      .where(eq(purchaseHistoryItems.purchaseHistoryId, purchaseHistoryId))
      .orderBy(purchaseHistoryItems.purchaseDate);
  }

  async createPurchaseHistoryItem(item: InsertPurchaseHistoryItem): Promise<PurchaseHistoryItem> {
    const id = randomUUID();
    const inserted = await db.insert(purchaseHistoryItems)
      .values({ id, ...item })
      .returning();
    return inserted[0];
  }

  // Barter Module
  async getAllBarterProducts(): Promise<BarterProduct[]> {
    return await db.select().from(barterProducts).orderBy(barterProducts.category, barterProducts.name);
  }

  async createBarterProduct(product: InsertBarterProduct): Promise<BarterProduct> {
    const id = randomUUID();
    const inserted = await db.insert(barterProducts)
      .values({ id, ...product })
      .returning();
    return inserted[0];
  }

  async updateBarterProduct(id: string, product: Partial<InsertBarterProduct>): Promise<BarterProduct | undefined> {
    const updated = await db.update(barterProducts)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(barterProducts.id, id))
      .returning();
    return updated[0];
  }

  async deleteBarterProduct(id: string): Promise<boolean> {
    await db.delete(barterProducts).where(eq(barterProducts.id, id));
    return true;
  }

  async deleteAllBarterProducts(): Promise<void> {
    await db.delete(barterProducts);
  }

  async getAllBarterSettings(): Promise<BarterSettings[]> {
    return await db.select().from(barterSettings);
  }

  async upsertBarterSetting(key: string, value: string, description?: string): Promise<BarterSettings> {
    const existing = await db.select().from(barterSettings).where(eq(barterSettings.key, key)).limit(1);
    
    if (existing.length > 0) {
      const updated = await db.update(barterSettings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(barterSettings.key, key))
        .returning();
      return updated[0];
    } else {
      const id = randomUUID();
      const inserted = await db.insert(barterSettings)
        .values({ id, key, value, description })
        .returning();
      return inserted[0];
    }
  }

  async getBarterSimulationsByUser(userId: string): Promise<BarterSimulation[]> {
    return await db.select().from(barterSimulations)
      .where(eq(barterSimulations.userId, userId))
      .orderBy(desc(barterSimulations.createdAt));
  }

  async getBarterSimulation(id: string): Promise<BarterSimulation | undefined> {
    const sim = await db.select().from(barterSimulations)
      .where(eq(barterSimulations.id, id))
      .limit(1);
    
    if (sim.length === 0) return undefined;
    
    return sim[0];
  }

  async createBarterSimulation(simulation: InsertBarterSimulation, items: InsertBarterSimulationItem[]): Promise<BarterSimulation> {
    const id = randomUUID();
    const inserted = await db.insert(barterSimulations)
      .values({ id, ...simulation })
      .returning();
    
    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        id: randomUUID(),
        simulationId: id,
        ...item
      }));
      await db.insert(barterSimulationItems).values(itemsToInsert);
    }
    
    return inserted[0];
  }

  async updateBarterSimulation(id: string, simulation: Partial<InsertBarterSimulation>): Promise<BarterSimulation | undefined> {
    const updated = await db.update(barterSimulations)
      .set({ ...simulation, updatedAt: new Date() })
      .where(eq(barterSimulations.id, id))
      .returning();
    
    if (updated.length === 0) return undefined;
    return updated[0];
  }

  async deleteBarterSimulation(id: string): Promise<boolean> {
    await db.delete(barterSimulations).where(eq(barterSimulations.id, id));
    return true;
  }

  // Sales Targets - Kanban de Metas
  async getKanbanData(userId: string, seasonId: string): Promise<any> {
    // Buscar taxas de investimento por cliente e categoria do menu Mercado
    const clientRatesData = await db.execute(sql`
      SELECT 
        cmr.client_id,
        c.type as segmento,
        cmr.investment_per_ha
      FROM client_market_rates cmr
      JOIN categories c ON c.id = cmr.category_id
      WHERE cmr.user_id = ${userId}
        AND cmr.season_id = ${seasonId}
    `);

    // Mapear taxas por cliente e segmento
    const taxasPorClienteSegmento: any = {};
    for (const rate of clientRatesData.rows as any[]) {
      if (!taxasPorClienteSegmento[rate.client_id]) {
        taxasPorClienteSegmento[rate.client_id] = {};
      }
      taxasPorClienteSegmento[rate.client_id][rate.segmento] = parseFloat(rate.investment_per_ha) || 0;
    }

    // Buscar clientes 80-20 do usuário com potenciais e vendas realizadas
    const clientsData = await db.execute(sql`
      SELECT 
        ucl.id as client_id,
        COALESCE(ucl.custom_name, mc.name) as client_name,
        ucl.planting_area,
        ucl.is_top80_20
      FROM user_client_links ucl
      JOIN master_clients mc ON mc.id = ucl.master_client_id
      WHERE ucl.user_id = ${userId}
        AND ucl.is_top80_20 = true
        AND ucl.is_active = true
      ORDER BY client_name
    `);

    // Batch fetch all sales for all clients at once (no N+1 queries)
    const clientIds = (clientsData.rows as any[]).map((c: any) => String(c.client_id));
    
    const allSalesRaw = clientIds.length > 0 ? await db.select({
      clientId: sales.clientId,
      segmento: categories.type,
      totalVendido: sql<number>`COALESCE(SUM(${sales.totalAmount}), 0)`.as('total_vendido')
    })
      .from(sales)
      .innerJoin(products, eq(sales.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        inArray(sales.clientId, clientIds),
        eq(sales.seasonId, seasonId),
        eq(sales.userId, userId)
      ))
      .groupBy(sales.clientId, categories.type) : [];

    const allSalesData = { rows: allSalesRaw.map(r => ({ client_id: r.clientId, segmento: r.segmento, total_vendido: r.totalVendido })) };

    // Map sales by client and segment
    const vendasPorClienteSegmento: any = {};
    for (const sale of allSalesData.rows as any[]) {
      if (!vendasPorClienteSegmento[sale.client_id]) {
        vendasPorClienteSegmento[sale.client_id] = {};
      }
      vendasPorClienteSegmento[sale.client_id][sale.segmento] = parseFloat(sale.total_vendido);
    }

    // Batch fetch all targets for all clients at once (no N+1 queries)
    const allTargetsData = clientIds.length > 0 ? await db.select()
      .from(salesTargets)
      .where(and(
        eq(salesTargets.userId, userId),
        eq(salesTargets.seasonId, seasonId)
      )) : [];

    // Map targets by client and segment
    const capturadoPorClienteSegmento: any = {};
    for (const target of allTargetsData) {
      if (!capturadoPorClienteSegmento[target.clientId]) {
        capturadoPorClienteSegmento[target.clientId] = {};
      }
      capturadoPorClienteSegmento[target.clientId][target.segmento] = parseFloat(target.valorCapturado);
    }

    // Para cada cliente, calcular potenciais e realizados por segmento
    const clients = [];
    for (const client of clientsData.rows as any[]) {
      const vendidoPorSegmento = vendasPorClienteSegmento[client.client_id] || {};
      const capturadoPorSegmento = capturadoPorClienteSegmento[client.client_id] || {};

      // Calcular potenciais usando taxas específicas do cliente do menu Mercado
      const area = parseFloat(client.planting_area) || 0;
      const clientRates = taxasPorClienteSegmento[client.client_id] || {};
      const potenciais = {
        fertilizantes: area * (clientRates.fertilizantes || 0),
        agroquimicos: area * (clientRates.agroquimicos || 0),
        especialidades: area * (clientRates.especialidades || 0),
        sementes: area * (clientRates.sementes || 0),
        corretivos: area * (clientRates.corretivos || 0)
      };

      clients.push({
        id: client.client_id,
        name: client.client_name,
        area: area,
        segmentos: {
          fertilizantes: {
            potencial: potenciais.fertilizantes,
            realizado: vendidoPorSegmento.fertilizantes || 0,
            capturado: capturadoPorSegmento.fertilizantes || 0,
            oportunidade: Math.max(0, potenciais.fertilizantes - (vendidoPorSegmento.fertilizantes || 0))
          },
          agroquimicos: {
            potencial: potenciais.agroquimicos,
            realizado: vendidoPorSegmento.agroquimicos || 0,
            capturado: capturadoPorSegmento.agroquimicos || 0,
            oportunidade: Math.max(0, potenciais.agroquimicos - (vendidoPorSegmento.agroquimicos || 0))
          },
          especialidades: {
            potencial: potenciais.especialidades,
            realizado: vendidoPorSegmento.especialidades || 0,
            capturado: capturadoPorSegmento.especialidades || 0,
            oportunidade: Math.max(0, potenciais.especialidades - (vendidoPorSegmento.especialidades || 0))
          },
          sementes: {
            potencial: potenciais.sementes,
            realizado: vendidoPorSegmento.sementes || 0,
            capturado: capturadoPorSegmento.sementes || 0,
            oportunidade: Math.max(0, potenciais.sementes - (vendidoPorSegmento.sementes || 0))
          },
          corretivos: {
            potencial: potenciais.corretivos,
            realizado: vendidoPorSegmento.corretivos || 0,
            capturado: capturadoPorSegmento.corretivos || 0,
            oportunidade: Math.max(0, potenciais.corretivos - (vendidoPorSegmento.corretivos || 0))
          }
        }
      });
    }

    return { clients };
  }

  async getSalesTargets(userId: string, seasonId?: string): Promise<SalesTarget[]> {
    const conditions = [eq(salesTargets.userId, userId)];
    
    if (seasonId) {
      conditions.push(eq(salesTargets.seasonId, seasonId));
    }
    
    return await db.select()
      .from(salesTargets)
      .where(and(...conditions))
      .orderBy(desc(salesTargets.createdAt));
  }

  async createSalesTarget(userId: string, clientId: string, segmento: string, valorCapturado: number, seasonId: string, subcategories?: Record<string, number>): Promise<SalesTarget> {
    const id = randomUUID();
    const inserted = await db.insert(salesTargets)
      .values({
        id,
        userId,
        clientId,
        segmento,
        seasonId,
        valorCapturado: valorCapturado.toString(),
        subcategories: subcategories ? JSON.stringify(subcategories) : null
      })
      .returning();
    return inserted[0];
  }

  async updateSalesTarget(id: string, valorCapturado: number, subcategories?: Record<string, number>): Promise<SalesTarget> {
    const updated = await db.update(salesTargets)
      .set({
        valorCapturado: valorCapturado.toString(),
        subcategories: subcategories ? JSON.stringify(subcategories) : null,
        updatedAt: new Date()
      })
      .where(eq(salesTargets.id, id))
      .returning();
    
    if (updated.length === 0) {
      throw new Error("Sales target not found");
    }
    
    return updated[0];
  }

  async deleteSalesTarget(id: string, userId: string): Promise<boolean> {
    await db.delete(salesTargets)
      .where(and(
        eq(salesTargets.id, id),
        eq(salesTargets.userId, userId)
      ));
    return true;
  }

  async getSystemSettings(): Promise<{ allowUserRegistration: boolean } | undefined> {
    const [settings] = await db.select()
      .from(systemSettings)
      .limit(1);
    
    return settings ? {
      allowUserRegistration: settings.allowUserRegistration
    } : undefined;
  }
}

export const storage = new DBStorage();
