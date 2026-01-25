import * as XLSX from 'xlsx';
import { storage } from './storage';
import type { InsertClient, InsertProduct, InsertSale, SeasonParameter } from '@shared/schema';

export interface ExcelRow {
  Usuario?: string;
  __EMPTY?: string;
  __EMPTY_1?: string;
  __EMPTY_2?: string;
  'Tabla de Precio'?: string;
  'Num. Pedido'?: string;
  Mercadería?: string;
  Fabricante?: string;
  Subgrupo?: string;
  ' Vl.Unitario Medio '?: number;
  'Cant. Pedido'?: number;
  ' Vl. Pedido '?: number;
  'Plan Fin.'?: string;
  'Fecha Emisión'?: number | string;
  'Fecha Venc.'?: number | string;
  Sucursal?: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedSales: number;
  skippedDuplicates: number;
  createdClients: number;
  createdProducts: number;
  barterSales: number;
  errors: string[];
}

export interface ClientImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
}

function normalizeClientName(name: string): string {
  // Normalizar nome do cliente: remover acentos, converter para minúsculas, remover espaços extras e pontuação
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[.,\-\s]/g, '') // Remove pontos, vírgulas, hífens e espaços
    .toLowerCase()
    .trim();
}

/**
 * Busca ou cria master client + user client link
 * 1. Busca master client por nome normalizado
 * 2. Se encontrou: verifica se usuário já tem link, senão cria
 * 3. Se não encontrou: cria master client + cria link
 */
async function getOrCreateClientLink(
  clientName: string,
  regionId: string,
  userId: string
): Promise<string> {
  // Buscar master client por nome normalizado
  const masterClient = await storage.findMasterClientByName(clientName);

  if (masterClient) {
    // Master client existe - verificar se usuário já tem link
    const existingLink = await storage.getUserClientLink(userId, masterClient.id);

    if (existingLink) {
      // Link já existe
      return existingLink.id;
    }

    // Criar novo link para este usuário
    const newLink = await storage.createUserClientLink({
      userId,
      masterClientId: masterClient.id,
      customName: null,
      plantingArea: null,
      cultures: null,
      plantingProgress: "0.00",
      isTop80_20: false,
      isActive: true
    });

    return newLink.id;
  }

  // Master client não existe - criar master + link
  const newMasterClient = await storage.createMasterClient({
    name: clientName,
    regionId: regionId,
    plantingArea: null,
    cultures: [],
    isActive: true
  });

  const newLink = await storage.createUserClientLink({
    userId,
    masterClientId: newMasterClient.id,
    customName: null,
    plantingArea: null,
    cultures: null,
    plantingProgress: "0.00",
    isTop80_20: false,
    isActive: true
  });

  return newLink.id;
}

function parseExcelDate(excelDate: any): Date | null {
  if (!excelDate) return null;

  if (typeof excelDate === 'number') {
    // Excel armazena datas como número de dias desde 1900-01-01
    // Mas há um bug histórico: Excel conta 1900 como ano bissexto (incorreto)
    const EXCEL_EPOCH = new Date(1899, 11, 30); // 30 de dezembro de 1899
    const daysOffset = excelDate;
    const date = new Date(EXCEL_EPOCH.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return date;
  }

  if (typeof excelDate === 'string') {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function normalizeNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    let normalized = value.trim();

    normalized = normalized.replace(/\./g, '');
    normalized = normalized.replace(',', '.');

    if (normalized.includes('/')) {
      const parts = normalized.split('/');
      if (parts.length === 2) {
        const numerator = parseFloat(parts[0]);
        const denominator = parseFloat(parts[1]);
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          return numerator / denominator;
        }
      }
    }

    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

function resolveCategoryId(subgrupo: string | undefined, categories: any[]): string {
  if (!subgrupo) {
    return categories[0]?.id || 'cat-fertilizantes';
  }

  const normalized = subgrupo.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Mapeamento específico para sementes (subcategorias específicas)
  if (normalized.includes('soja') || normalized.includes('soya')) {
    const category = categories.find(c => c.id === 'cat-sem-soja');
    if (category) return category.id;
  }

  if (normalized.includes('milho') || normalized.includes('maiz') || normalized.includes('corn')) {
    const category = categories.find(c => c.id === 'cat-sem-milho');
    if (category) return category.id;
  }

  if (normalized.includes('trigo') || normalized.includes('wheat')) {
    const category = categories.find(c => c.id === 'cat-sem-trigo');
    if (category) return category.id;
  }

  // Sementes genéricas ou diversas
  if (normalized.includes('semente') || normalized.includes('semilla') || normalized.includes('semilha') || normalized.includes('seed')) {
    const category = categories.find(c => c.id === 'cat-sem-diversas');
    if (category) return category.id;
  }

  // Outras categorias
  const categoryMap: Record<string, string[]> = {
    'cat-fertilizantes': ['fertilizante', 'fertilizantes', 'fertilizer', 'fertilizers', 'fert', 'adub'],
    'cat-agroquimicos': ['agroquimico', 'agroquimicos', 'agrochemical', 'herbicida', 'fungicida', 'inseticida', 'defensivo'],
    'cat-especialidades': ['especialidade', 'especialidades', 'specialty', 'specialties', 'especial'],
  };

  for (const [categoryId, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      const category = categories.find(c => c.id === categoryId);
      if (category) return category.id;
    }
  }

  // Tentar match por nome da categoria
  const matchedCategory = categories.find(c =>
    c.name.toLowerCase().includes(normalized) ||
    normalized.includes(c.name.toLowerCase())
  );

  if (matchedCategory) return matchedCategory.id;

  return categories[0]?.id || 'cat-fertilizantes';
}

function normalizeTier(tablaPrecio?: string): string {
  if (!tablaPrecio) return 'abaixo_lista';

  const normalized = tablaPrecio.toLowerCase().trim();

  if (normalized.includes('verde') || normalized.includes('green')) return 'verde';
  if (normalized.includes('amarela') || normalized.includes('amarilla') || normalized.includes('amarillo') || normalized.includes('yellow')) return 'amarela';
  if (normalized.includes('vermelha') || normalized.includes('roja') || normalized.includes('rojo') || normalized.includes('red')) return 'vermelha';
  if (normalized.includes('barter')) return 'barter';
  if (normalized.includes('abaixo') || normalized.includes('lista')) return 'abaixo_lista';

  return 'abaixo_lista';
}

function extractPackageSize(productName: string): number | null {
  if (!productName) return null;

  const patterns = [
    /(\d+(?:\.\d+)?)\s*LTS?/i,
    /(\d+(?:\.\d+)?)\s*L\b/i,
    /(\d+(?:\.\d+)?)\s*LITROS?/i,
    /(\d+(?:\.\d+)?)\s*KGS?/i,
    /(\d+(?:\.\d+)?)\s*KILOS?/i,
    /(\d+(?:\.\d+)?)\s*GRS?/i,
    /(\d+(?:\.\d+)?)\s*GRAMOS?/i,
  ];

  for (const pattern of patterns) {
    const match = productName.match(pattern);
    if (match) {
      const size = parseFloat(match[1]);
      if (!isNaN(size)) {
        return size;
      }
    }
  }

  return null;
}


function classifySeasonFromDate(dueDate: Date, seasonParameters: SeasonParameter[]): { seasonName: string; seasonType: string; year: number } {
  const month = dueDate.getMonth() + 1;
  const day = dueDate.getDate();
  const year = dueDate.getFullYear();

  for (const param of seasonParameters) {
    if (param.dueDateMonth === month && param.dueDateDay === day) {
      let seasonName = param.labelPattern;
      const nextYear = year + 1;

      seasonName = seasonName
        .replace('{year}', year.toString().slice(-2))
        .replace('{next_year}', nextYear.toString().slice(-2))
        .replace('YYYY', year.toString());

      return {
        seasonName,
        seasonType: param.type,
        year,
      };
    }
  }

  return {
    seasonName: `Safra ${year}`,
    seasonType: 'soja_verao',
    year,
  };
}

export async function importExcelFile(fileBuffer: Buffer, selectedSeasonId: string, userId: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    importedSales: 0,
    skippedDuplicates: 0,
    createdClients: 0,
    createdProducts: 0,
    barterSales: 0,
    errors: [],
  };

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(firstSheet);

    result.totalRows = rows.length;

    // Gerar ID único para este lote de importação
    const importBatchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const categories = await storage.getAllCategories();
    const regions = await storage.getAllRegions();
    const seasonParameters = await storage.getAllSeasonParameters();

    // Pré-carregar todos os orderCodes existentes do usuário para verificação de duplicatas
    const existingOrderCodes = await storage.getExistingOrderCodes(userId);

    // Cache para evitar buscas repetidas durante a importação
    const clientLinkCache = new Map<string, string>();
    const productCache = new Map<string, string>();
    const skippedOrderCodes = new Set<string>(); // Rastrear pedidos únicos que foram pulados

    let currentClientName: string | null = null;
    let currentOrderCode: string | null = null; // Guardar último orderCode para aplicar em linhas seguintes

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Detectar linha com nome do cliente (formato: "Entidad : NOME_DO_CLIENTE")
        if (row.__EMPTY_1 && typeof row.__EMPTY_1 === 'string' && row.__EMPTY_1.includes('Entidad :')) {
          currentClientName = row.__EMPTY_1.replace('Entidad :', '').trim();
          currentOrderCode = null; // Resetar orderCode ao mudar de cliente
          continue;
        }

        // Pular linhas que não tem produto (linhas de cabeçalho ou vazias)
        if (!row.Mercadería) {
          continue;
        }

        if (!currentClientName) {
          continue;
        }

        // Validar campos obrigatórios - testar diferentes variações do campo de data
        const rowAny = row as any;
        const fechaVenc = rowAny['Fecha Venc.'] || rowAny['Fecha Venc'] || rowAny[' Fecha Venc.'] || rowAny['Fecha Venc. '];
        if (!fechaVenc) {
          result.errors.push(`Linha ${i + 1}: falta data de vencimento`);
          continue;
        }

        // Buscar ou criar client link usando o sistema de master clients
        let clientLinkId = clientLinkCache.get(currentClientName);
        if (!clientLinkId) {
          const defaultRegionId = regions[0]?.id || 'reg-alto-parana';
          clientLinkId = await getOrCreateClientLink(currentClientName!, defaultRegionId, userId);
          clientLinkCache.set(currentClientName!, clientLinkId);
          result.createdClients++;
        }

        const categoryId = resolveCategoryId(row.Subgrupo, categories);
        const fabricante = row.Fabricante?.trim() || null;
        const packageSize = extractPackageSize(row.Mercadería!);

        const productKey = `${row.Mercadería}-${categoryId}`;
        let productId = productCache.get(productKey);
        let product: any = null;

        if (!productId) {
          const existingProducts = await storage.getAllProducts();
          const existingProduct = existingProducts.find(p =>
            p.name.toLowerCase() === row.Mercadería!.toLowerCase() &&
            p.categoryId === categoryId
          );

          if (existingProduct) {
            productId = existingProduct.id;
            product = existingProduct;

            // Atualizar produto existente se houver novos dados
            const needsUpdate =
              (fabricante && !existingProduct.marca) ||
              (packageSize !== null && !existingProduct.packageSize);

            if (needsUpdate) {
              const updateData: Partial<InsertProduct> = {};

              if (fabricante && !existingProduct.marca) {
                updateData.marca = fabricante;
              }

              if (packageSize !== null && !existingProduct.packageSize) {
                updateData.packageSize = packageSize.toString();
              }

              await storage.updateProduct(productId, updateData);
              // Atualizar cache do produto
              const updatedProducts = await storage.getAllProducts();
              product = updatedProducts.find(p => p.id === productId);
            }
          } else {
            const { detectSubcategory } = await import("./product-classifier");
            const classification = categoryId === 'cat-agroquimicos'
              ? detectSubcategory(row.Mercadería!)
              : null;

            const newProduct: InsertProduct = {
              name: row.Mercadería!,
              categoryId,
              subcategoryId: null, // classification?.subcategoryId || null (Desativado para evitar erro de FK)
              description: row.Fabricante || null,
              marca: fabricante,
              packageSize: packageSize?.toString() || null,
            };
            const created = await storage.createProduct(newProduct);
            productId = created.id;
            product = created;
            result.createdProducts++;
          }
          productCache.set(productKey, productId);
        } else {
          // Buscar produto do cache
          const existingProducts = await storage.getAllProducts();
          product = existingProducts.find(p => p.id === productId);
        }

        const dueDate = parseExcelDate(fechaVenc);
        if (!dueDate) {
          result.errors.push(`Data de vencimento inválida para ${currentClientName} - ${row.Mercadería}`);
          continue;
        }

        // Usar safra selecionada pelo usuário ao invés de classificar automaticamente
        const seasonId = selectedSeasonId;

        const tier = normalizeTier(row['Tabla de Precio']);
        if (tier === 'barter') {
          result.barterSales++;
        }

        const category = categories.find(c => c.id === categoryId);
        let commissionRate = '0.00';
        let estimatedMargin = 0;

        if (category && tier !== 'barter') {
          switch (tier) {
            case 'verde':
              commissionRate = category.greenCommission;
              // Usar margem mínima da faixa verde (acima do limite verde)
              estimatedMargin = parseFloat(category.greenMarginMin);
              break;
            case 'amarela':
              commissionRate = category.yellowCommission;
              // Usar margem média da faixa amarela
              estimatedMargin = (parseFloat(category.yellowMarginMin) + parseFloat(category.yellowMarginMax)) / 2;
              break;
            case 'vermelha':
              commissionRate = category.redCommission;
              // Usar margem média da faixa vermelha
              estimatedMargin = (parseFloat(category.redMarginMin) + parseFloat(category.redMarginMax)) / 2;
              break;
            case 'abaixo_lista':
              commissionRate = category.belowListCommission;
              // Usar margem média abaixo do limite vermelho mínimo
              estimatedMargin = parseFloat(category.redMarginMin) / 2;
              break;
          }
        }

        const totalAmountRaw = rowAny[' Vl. Pedido '] || rowAny['Vl. Pedido'] || rowAny['Vl. Pedido '] || rowAny[' Vl. Pedido'];
        const totalAmount = normalizeNumeric(totalAmountRaw) || 0;
        const ivaRate = parseFloat(category?.defaultIva || '10');
        const amountBeforeIva = totalAmount / (1 + ivaRate / 100);
        const commissionAmount = (amountBeforeIva * parseFloat(commissionRate)) / 100;

        const saleDate = parseExcelDate(row['Fecha Emisión']) || new Date();

        // Calcular quantidade real: Cant. Pedido × packageSize
        const cantPedido = normalizeNumeric(row['Cant. Pedido']) || 0;
        const productPackageSize = product?.packageSize ? parseFloat(product.packageSize) : 1;
        const quantity = cantPedido * productPackageSize;

        // Calcular pontos Timac (apenas para produtos Timac da categoria Especialidades)
        // Pontos = Cant. Pedido (unidades) × pontos por unidade
        let saleTimacPoints: number | null = null;

        // Verificar se é produto Timac E categoria Especialidades
        // Normalizar marca para comparação (remover todos os espaços e acentos)
        const normalizedMarca = product?.marca
          ?.toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/\s+/g, '') // Remove todos os espaços
          || '';

        // Aceita "TIMAC", "TIMACAGRO", etc (começa com TIMAC)
        const isTimac = normalizedMarca.startsWith('TIMAC');
        const isEspecialidades = categoryId === 'cat-especialidades';

        if (isTimac && isEspecialidades) {
          // FERTIACTYL LEGUMINOSAS = 3 pontos, outros produtos Timac = 1 ponto
          const pointsPerUnit = product.name.toUpperCase().includes('FERTIACTYL LEGUMINOSAS') ? 3 : 1;
          saleTimacPoints = cantPedido * pointsPerUnit;
        }

        // Extrair Num. Pedido da linha atual, ou usar o último orderCode válido
        // (pedidos com múltiplos produtos têm orderCode apenas na primeira linha)
        if (row['Num. Pedido']) {
          currentOrderCode = row['Num. Pedido'].toString().trim();
        }

        const orderCode = currentOrderCode;

        // NOTA: NÃO verificamos duplicatas apenas por orderCode porque um pedido
        // pode ter múltiplos produtos. Cada produto é uma venda separada.
        // A verificação correta seria orderCode + productId, mas como a planilha
        // não tem duplicatas reais (mesmo produto no mesmo pedido), podemos
        // importar todas as linhas.


        const newSale: InsertSale = {
          categoryId,
          clientId: clientLinkId!,
          productId,
          seasonId: seasonId,
          userId: userId,
          saleDate,
          dueDate,
          totalAmount: totalAmount.toString(),
          quantity: quantity > 0 ? quantity.toString() : null,
          margin: estimatedMargin.toString(),
          ivaRate: ivaRate.toString(),
          commissionRate,
          commissionAmount: commissionAmount.toString(),
          commissionTier: tier,
          timacPoints: saleTimacPoints !== null ? saleTimacPoints.toString() : null,
          isManual: false,
          importBatchId,
          orderCode: orderCode,
        };

        await storage.createSale(newSale);
        result.importedSales++;

      } catch (error) {
        result.errors.push(`Erro ao processar linha: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    // Atualizar contador de duplicatas com o total de pedidos únicos pulados
    result.skippedDuplicates = skippedOrderCodes.size;
    result.success = result.importedSales > 0;
    return result;

  } catch (error) {
    result.errors.push(`Erro ao ler arquivo Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    return result;
  }
}

export async function importClientsFromExcel(buffer: Buffer, userId: string): Promise<ClientImportResult> {
  const result: ClientImportResult = {
    success: false,
    created: 0,
    updated: 0,
    errors: [],
  };

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (data.length < 2) {
      result.errors.push('Arquivo Excel vazio ou sem dados');
      return result;
    }

    // Buscar todas as regiões para criar novas se necessário
    const regions = await storage.getAllRegions();
    const regionMap = new Map(regions.map((r: any) => [r.name.toLowerCase(), r.id]));

    // Começar da linha 1 (primeira linha é o cabeçalho)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Coluna A: Cliente (80/20)
      // Coluna B: Área de plantio em hectares (ha)
      // Coluna C: região
      const clientName = row[0]?.toString().trim();
      const plantingArea = row[1]?.toString().trim();
      const regionName = row[2]?.toString().trim();

      if (!clientName) {
        continue; // Pular linhas sem nome de cliente
      }

      // Determinar se é cliente 80/20 (se o nome contém "80/20")
      const isTop8020 = clientName.toLowerCase().includes('80/20');

      // Buscar ou criar região
      let regionId = regionMap.get(regionName?.toLowerCase());
      if (!regionId && regionName) {
        // Criar nova região
        const newRegion = await storage.createRegion({
          name: regionName,
        });
        regionId = newRegion.id;
        regionMap.set(regionName.toLowerCase(), regionId);
      }

      // Usar sistema de master clients
      const defaultRegionId = regionId || regions[0]?.id || 'reg-alto-parana';

      // Buscar ou criar master client e link
      const masterClient = await storage.findMasterClientByName(clientName);

      if (masterClient) {
        // Master client existe - buscar ou criar link
        let link = await storage.getUserClientLink(userId, masterClient.id);

        if (link) {
          // Atualizar link existente
          await storage.updateUserClientLink(link.id, {
            plantingArea: plantingArea || link.plantingArea,
            isTop80_20: isTop8020,
          });
          result.updated++;
        } else {
          // Criar novo link
          await storage.createUserClientLink({
            userId,
            masterClientId: masterClient.id,
            customName: null,
            plantingArea: plantingArea || null,
            cultures: null,
            plantingProgress: "0.00",
            isTop80_20: isTop8020,
            isActive: true
          });
          result.created++;
        }

        // Atualizar master client se necessário
        if (plantingArea && !masterClient.plantingArea) {
          await storage.updateMasterClient(masterClient.id, {
            plantingArea: plantingArea,
            regionId: defaultRegionId
          });
        }
      } else {
        // Criar novo master client + link
        const newMasterClient = await storage.createMasterClient({
          name: clientName,
          regionId: defaultRegionId,
          plantingArea: plantingArea || null,
          cultures: [],
          isActive: true
        });

        await storage.createUserClientLink({
          userId,
          masterClientId: newMasterClient.id,
          customName: null,
          plantingArea: null,
          cultures: null,
          plantingProgress: "0.00",
          isTop80_20: isTop8020,
          isActive: true
        });

        result.created++;
      }
    }

    result.success = result.created > 0 || result.updated > 0;
    return result;

  } catch (error) {
    result.errors.push(`Erro ao importar clientes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    return result;
  }
}

export async function importPlanningProducts(
  productsBuffer: Buffer,       // "Planejamento de Vendas 2026.xls" (Preço + Nome)
  dosesBuffer: Buffer,          // "Planilha de produtos.xlsx" (Dose + Nome)
  seasonId: string
): Promise<{ success: boolean; created: number; updated: number; errors: string[] }> {
  const result = { success: false, created: 0, updated: 0, errors: [] as string[] };

  try {
    // 1. Ler planilha de PREÇOS (Base principal)
    const productsWorkbook = XLSX.read(productsBuffer, { type: 'buffer' });
    const productsSheet = productsWorkbook.Sheets[productsWorkbook.SheetNames[0]];
    const productsRows = XLSX.utils.sheet_to_json<any>(productsSheet);

    // 2. Ler planilha de DOSES
    const dosesWorkbook = XLSX.read(dosesBuffer, { type: 'buffer' });
    const dosesSheet = dosesWorkbook.Sheets[dosesWorkbook.SheetNames[0]];
    const dosesRows = XLSX.utils.sheet_to_json<any>(dosesSheet);

    // Mapa de Doses: Nome Normalizado -> Dose
    const dosagemMap = new Map<string, number>();

    // Helper para normalizar nome (remover acentos, espaços, caixa alta)
    const normalizeName = (name: string) => {
      if (!name) return '';
      return name.toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '') // Mantém apenas letras e números
        .trim();
    };

    // Helper para detectar segmento pelo nome do produto
    const detectSegment = (name: string): string => {
      const n = name.toLowerCase();
      if (n.includes('inseticida') || n.includes('perito') || n.includes('abamec') || n.includes('lambda')) return 'inseticida';
      if (n.includes('fungicida') || n.includes('vessarya') || n.includes('azoxistrobina') || n.includes('tebuconazol') || n.includes('mancozeb')) return 'fungicida';
      if (n.includes('herbicida') || n.includes('glifosato') || n.includes('paraquat') || n.includes('2,4-d') || n.includes('cletodim')) return 'herbicida';
      if (n.includes('tratamento') || n.includes(' ts ') || n.endsWith(' ts') || n.includes('rizospirilum') || n.includes('dermacor')) return 'ts';

      // Fallback baseado em palavras-chave genéricas se não encontrou específico
      if (n.includes('dessec')) return 'herbicida';

      return 'outros';
    };

    // Processar planilha de DOSES para popular o mapa
    for (const row of dosesRows) {
      // Ajuste conform a estrutura real da planilha de doses (assumindo colunas "Produto" e "Dose")
      // O usuário pode precisar ajustar isso ou enviar o cabeçalho correto
      const name = row['Produto'] || row['Mercadoria'] || row['Nome'] || Object.values(row)[0];
      // Tentar encontrar coluna de dose
      const doseVal = row['Dose'] || row['Doses'] || row['Dose/ha'] || row['L/ha'] || row['Kg/ha'];

      if (name && doseVal) {
        const normName = normalizeName(String(name));
        const cleanDose = typeof doseVal === 'number' ? doseVal : parseFloat(String(doseVal).replace(',', '.'));

        if (normName && !isNaN(cleanDose)) {
          dosagemMap.set(normName, cleanDose);
        }
      }
    }

    // Buscar produtos de planejamento já existentes para atualizar ou criar
    const existingPlanningProducts = await storage.getPlanningProducts(seasonId);
    const existingMap = new Map(existingPlanningProducts.map(p => [normalizeName(p.name), p]));

    for (const row of productsRows) {
      // Ajuste conforme a estrutura da planilha de PREÇOS "Planejamento de Vendas 2026.xls"
      // Provavelmente colunas: "Produto", "Preço", "Unidade"
      const nameRaw = row['Produto'] || row['Mercadoria'] || row['Descrição'] || row['Material'];
      if (!nameRaw) continue;

      const normName = normalizeName(String(nameRaw));
      const existing = existingMap.get(normName);

      // Extrair Preço
      let price = normalizeNumeric(row['Preço'] || row['Valor'] || row['Unitario'] || row['Precio']);
      if (price === null) price = 0;

      // Extrair Unidade
      const unit = row['Unidade'] || row['UN'] || row['Emb'] || 'L';

      // Buscar dose no mapa
      const dosePerHa = dosagemMap.get(normName) || null;

      // Detectar segmento
      const segment = detectSegment(String(nameRaw));

      if (existing) {
        // Update
        await storage.updatePlanningProduct(existing.id, {
          price: price.toString(),
          dosePerHa: dosePerHa ? dosePerHa.toString() : existing.dosePerHa,
          segment,
          unit
        });
        result.updated++;
      } else {
        // Create
        if (dosePerHa !== null || price > 0) { // Só cria se tiver info relevante
          await storage.createPlanningProduct({
            name: String(nameRaw),
            seasonId,
            price: price.toString(),
            dosePerHa: dosePerHa ? dosePerHa.toString() : null,
            segment,
            unit
          });
          result.created++;
        }
      }
    }

    result.success = true;
  } catch (error) {
    result.errors.push(`Erro na importação: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
