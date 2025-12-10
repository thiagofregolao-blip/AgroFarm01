export interface ProductClassification {
  subcategoryId: string;
  confidence: 'high' | 'medium' | 'low';
}

const CLASSIFICATION_MAP = {
  'sub-tratamento-sementes': {
    exactMatches: [
      'RIZOSPIRILUM',
      'VITAGROW TS',
      'RIZOLIQ TOP',
      'DERMACOR',
      'CLORANTE 62',
      'HURACAN',
      'MAXIN RFC',
      'CROPSTAR',
      'RANCONA',
      'EVERGOL',
      'RIZODERMA MAX',
    ],
    keywords: [
      'AZOSPIRILLUM',
      'BIOESTIMULANTE',
      'BRADIRIZOBIUM',
      'RIZODERMA',
      'RIZOLIQ',
      'RIZOSPIRILUM',
      'VITAGROW',
      'TRICODERMA',
      'TS ',
      ' TS',
    ],
    activeIngredients: [
      'CLORANTRANILIPROLI 62',
      'FIPRONIL 25',
      'FLUDIOXINIL',
      'METALAXIL',
      'IPCONAZOLE',
      'PENFLUFEN',
    ]
  },
  'sub-dessecacao': {
    exactMatches: [
      '2,4 D',
      'CLETODIN',
      'CLOMAZERB',
      'CONFIRM',
      'APRESA',
      'FLUMITOP',
      'FOMEFLAG',
      'GLIFOSATO',
      'TECNUP',
      'GLUFOSINATO',
      'GLUFOSEC',
      'PIXXARO',
      'TEXARO',
      'VERDICT ULTRA',
      'ZETAPIR',
      'PARAQUAT',
      'SAFLUNEX',
      'STRIM',
      'SUNZONE',
      'TRICLON',
    ],
    keywords: [
      'GLIFOSATO',
      'GLUFOSINATO',
      'PARAQUAT',
      'CLOMAZONE',
      'FLUMIOXAZIN',
      'DICLOSULAN',
      'HALOXIFOP',
      'HALAUXIFENO',
      'IMAZETAPIR',
      'SAFLUFENACIL',
      'SULFENTRAZONE',
      'TRICLOPIR',
      'FOMESAFEN',
      'CLETODIM',
      'S-METALACLORO',
      '2,4D',
      '2,4 D',
    ],
    activeIngredients: []
  },
  'sub-inseticidas': {
    exactMatches: [
      'LASCAR',
      'PERITO ULTRA',
      'ABAMEC',
      'BATTUS GOLD',
      'ACEGOAL',
      'AGUILA',
      'MONITOR',
      'BULLDOCK',
      'TOXATRIM',
      'FENTHRIN',
      'GALIL',
      'AMPLIGO',
      'CLORANTE WG',
      'OVERTOP',
      'CLORPIRIFOS',
      'OBERON',
      'CRICKET',
      'FULMINANTE',
      'BELT',
      'CAYENNE',
      'LOYER',
      'CORAZA',
      'POINT 5',
      'METOMYL',
      'INTREPID',
      'PIRY PANDA',
      'EXALT',
      'QUINTAL XTRA',
      'EXPEDITION',
      'SOYGUARD',
      'THIODICARB',
      'ONLY',
      'THIAMEXPLANT',
      'ALSYSTIN',
    ],
    keywords: [
      'ACEFATO',
      'ABAMECTINA',
      'ACETAMIPRID',
      'BETACIFLUTRINA',
      'BIFENTRIN',
      'CLORANTRANILIPROLI 80',
      'CLORFENAPIR',
      'CLORPIRIFOS',
      'ESPIROMESIFENO',
      'ETIPROLE',
      'FIPRONIL 80',
      'FLUBENDIAMIDA',
      'IMIDACLOPRID',
      'LAMBDA',
      'LAMBDACIALOTRINA',
      'LUFENURON',
      'METOMIL',
      'METOXIFENOCIDE',
      'PIRIPROXIFEN',
      'SPINETORAN',
      'SULFOXAFLOR',
      'TEFLUBENZURON',
      'THIODICARB',
      'TIAMETOXAN',
      'TRIFLUMURON',
      'DINOTEFURAN',
    ],
    activeIngredients: []
  },
  'sub-fungicidas': {
    exactMatches: [
      'VESSARYA',
      'CLOROTALONIL',
      'ARMERO',
      'MURALLA',
      'VIOVAN',
      'APROACH',
      'AZIMUT',
      'DANKE',
      'ZAFIRO',
      'WETTER',
      'CRIPTON',
      'NATIVO',
    ],
    keywords: [
      'BENZOVINDIFLUPIR',
      'CLOROTALONIL',
      'MANCOZEB',
      'PICOXISTROBIN',
      'PROTHIOCONAZOLE',
      'PROTIO',
      'CIPROCONAZOLE',
      'TEBUCONAZOLE',
      'TEBUCO',
      'AZOXISTROBINA',
      'AZOXIS',
      'DIFENOCONAZOLE',
      'DIFENO',
      'TRIFLOXISTROBIN',
      'BIXAFEN',
    ],
    activeIngredients: []
  }
};

function normalizeProductName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSubcategory(productName: string): ProductClassification | null {
  if (!productName) return null;

  const normalizedName = normalizeProductName(productName);

  for (const [subcategoryId, config] of Object.entries(CLASSIFICATION_MAP)) {
    for (const exactMatch of config.exactMatches) {
      const normalizedMatch = normalizeProductName(exactMatch);
      if (normalizedName.includes(normalizedMatch)) {
        return { subcategoryId, confidence: 'high' };
      }
    }

    for (const keyword of config.keywords) {
      const normalizedKeyword = normalizeProductName(keyword);
      if (normalizedName.includes(normalizedKeyword)) {
        return { subcategoryId, confidence: 'medium' };
      }
    }

    for (const ingredient of config.activeIngredients) {
      const normalizedIngredient = normalizeProductName(ingredient);
      if (normalizedName.includes(normalizedIngredient)) {
        return { subcategoryId, confidence: 'low' };
      }
    }
  }

  return null;
}

export function classifyProductsBatch(products: Array<{ id: string; name: string; categoryId: string }>): Array<{ id: string; subcategoryId: string; confidence: string }> {
  const results: Array<{ id: string; subcategoryId: string; confidence: string }> = [];

  for (const product of products) {
    if (product.categoryId !== 'cat-agroquimicos') {
      continue;
    }

    const classification = detectSubcategory(product.name);
    if (classification) {
      results.push({
        id: product.id,
        subcategoryId: classification.subcategoryId,
        confidence: classification.confidence
      });
    }
  }

  return results;
}
