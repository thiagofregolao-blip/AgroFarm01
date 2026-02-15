# 🌱 APIs de NDVI - Alternativas ao AgroMonitoring

Este documento lista APIs e serviços que fornecem dados NDVI (Normalized Difference Vegetation Index) além do AgroMonitoring.

## 📊 Principais Alternativas

### 1. **Sentinel Hub** ⭐ (Recomendado)
**Website:** https://www.sentinel-hub.com/

**Características:**
- ✅ Dados gratuitos do programa Copernicus (Sentinel-2)
- ✅ Resolução: 10m (Sentinel-2)
- ✅ Frequência: 5 dias
- ✅ API REST completa
- ✅ NDVI, EVI, NDWI, e outros índices
- ✅ Histórico desde 2015

**Pricing:**
- Plano gratuito: 50.000 requests/mês
- Planos pagos a partir de €99/mês

**API Example:**
```javascript
// Sentinel Hub Process API
const response = await fetch('https://services.sentinel-hub.com/api/v1/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    input: {
      bounds: {
        bbox: [lon1, lat1, lon2, lat2],
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
      },
      data: [{
        type: "sentinel-2-l2a",
        dataFilter: {
          timeRange: {
            from: "2024-01-01T00:00:00Z",
            to: "2024-01-31T23:59:59Z"
          }
        }
      }]
    },
    output: {
      width: 512,
      height: 512,
      responses: [{
        identifier: "default",
        format: { type: "image/png" }
      }]
    },
    evalscript: `
      //VERSION=3
      function setup() {
        return {
          input: ["B04", "B08"],
          output: { bands: 1 }
        };
      }
      function evaluatePixel(samples) {
        let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
        return [ndvi];
      }
    `
  })
});
```

**Documentação:** https://docs.sentinel-hub.com/

---

### 2. **Google Earth Engine API**
**Website:** https://earthengine.google.com/

**Características:**
- ✅ Gratuito para uso acadêmico
- ✅ Dados: Sentinel-2, Landsat, MODIS
- ✅ Resolução: 10m (Sentinel-2), 30m (Landsat)
- ✅ Processamento em nuvem
- ✅ Histórico extenso (Landsat desde 1972)

**Pricing:**
- Gratuito para pesquisa/educação
- Comercial: contatar Google

**API Example:**
```javascript
// Earth Engine Python API (mais comum)
import ee

ee.Initialize()

# Calcular NDVI
collection = ee.ImageCollection('COPERNICUS/S2_SR') \
    .filterDate('2024-01-01', '2024-01-31') \
    .filterBounds(geometry)

def addNDVI(image):
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    return image.addBands(ndvi)

ndvi_collection = collection.map(addNDVI)
```

**Documentação:** https://developers.google.com/earth-engine

---

### 3. **Planet Labs API**
**Website:** https://www.planet.com/

**Características:**
- ✅ Alta resolução (3m)
- ✅ Frequência diária
- ✅ Dados comerciais premium
- ✅ API REST

**Pricing:**
- Planos a partir de $149/mês
- Trial disponível

**API Example:**
```javascript
const response = await fetch('https://api.planet.com/data/v1/item-types/PSScene4Band/items', {
  headers: {
    'Authorization': `api-key ${API_KEY}`
  }
});
```

**Documentação:** https://developers.planet.com/

---

### 4. **USGS Earth Explorer API**
**Website:** https://earthexplorer.usgs.gov/

**Características:**
- ✅ Dados gratuitos (Landsat, MODIS)
- ✅ Resolução: 30m (Landsat), 250m-1km (MODIS)
- ✅ Histórico desde 1972
- ✅ API disponível

**Pricing:**
- Gratuito

**Documentação:** https://www.usgs.gov/landsat-missions/landsat-data-access

---

### 5. **Maxar (DigitalGlobe)**
**Website:** https://www.maxar.com/

**Características:**
- ✅ Alta resolução (30cm-50cm)
- ✅ Dados comerciais premium
- ✅ API disponível

**Pricing:**
- Contato comercial

---

### 6. **HawkEye 360**
**Website:** https://www.he360.com/

**Características:**
- ✅ Dados de radiofrequência
- ✅ Foco em agricultura de precisão
- ✅ API disponível

---

### 7. **AgroAPI (Brasil)**
**Website:** https://www.agroapi.com.br/

**Características:**
- ✅ Focado no mercado brasileiro
- ✅ Dados de clima e NDVI
- ✅ API REST

**Pricing:**
- Contato comercial

---

## 🔄 Comparação Rápida

| API | Resolução | Frequência | Preço | Histórico | Dificuldade |
|-----|-----------|------------|-------|-----------|-------------|
| **Sentinel Hub** | 10m | 5 dias | Gratis/€99+ | 2015+ | ⭐⭐ |
| **Google Earth Engine** | 10-30m | Variável | Gratis* | 1972+ | ⭐⭐⭐ |
| **Planet Labs** | 3m | Diária | $149+ | Recente | ⭐⭐ |
| **USGS** | 30m-1km | Variável | Gratis | 1972+ | ⭐⭐⭐ |
| **AgroMonitoring** | 10m | 5 dias | Variável | 2015+ | ⭐ |

*Gratuito para pesquisa/educação

---

## 💡 Recomendações

### Para Projetos com Orçamento Limitado:
1. **Sentinel Hub** (plano gratuito) - Melhor custo-benefício
2. **USGS Earth Explorer** - Totalmente gratuito

### Para Alta Resolução:
1. **Planet Labs** - Melhor resolução (3m)
2. **Maxar** - Resolução ultra-alta (30cm)

### Para Processamento em Lote:
1. **Google Earth Engine** - Melhor para análises complexas
2. **Sentinel Hub** - Boa para processamento em tempo real

### Para Mercado Brasileiro:
1. **AgroAPI** - Focado no Brasil
2. **Sentinel Hub** - Cobertura global incluindo Brasil

---

## 🚀 Implementação Sugerida

### Opção 1: Sentinel Hub (Recomendado)

```typescript
// server/ndvi/sentinel-hub.ts
export class SentinelHubNDVI {
  private baseUrl = 'https://services.sentinel-hub.com/api/v1/process';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getNDVI(bounds: { lat1: number; lon1: number; lat2: number; lon2: number }, date: string) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        input: {
          bounds: {
            bbox: [bounds.lon1, bounds.lat1, bounds.lon2, bounds.lat2],
            properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
          },
          data: [{
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: {
                from: `${date}T00:00:00Z`,
                to: `${date}T23:59:59Z`
              }
            }
          }]
        },
        output: {
          width: 512,
          height: 512,
          responses: [{
            identifier: "default",
            format: { type: "image/png" }
          }]
        },
        evalscript: `
          //VERSION=3
          function setup() {
            return {
              input: ["B04", "B08"],
              output: { bands: 1 }
            };
          }
          function evaluatePixel(samples) {
            let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
            return [ndvi];
          }
        `
      })
    });

    return await response.json();
  }
}
```

### Opção 2: Google Earth Engine (via Python)

```python
# scripts/ndvi_gee.py
import ee
import json

# Inicializar Earth Engine
ee.Initialize()

def get_ndvi(bounds, start_date, end_date):
    geometry = ee.Geometry.Rectangle(bounds)
    
    collection = ee.ImageCollection('COPERNICUS/S2_SR') \
        .filterDate(start_date, end_date) \
        .filterBounds(geometry) \
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    
    def add_ndvi(image):
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        return image.addBands(ndvi)
    
    ndvi_collection = collection.map(add_ndvi)
    median = ndvi_collection.median()
    
    return median.select('NDVI')
```

---

## 📝 Próximos Passos

1. **Escolher API** baseado em orçamento e necessidades
2. **Criar conta** e obter API key
3. **Implementar integração** no backend
4. **Criar endpoint** `/api/ndvi` no servidor
5. **Adicionar visualização** no frontend (mapas, gráficos)

---

## 🔗 Links Úteis

- [Sentinel Hub Docs](https://docs.sentinel-hub.com/)
- [Google Earth Engine](https://earthengine.google.com/)
- [Planet Labs API](https://developers.planet.com/)
- [USGS Landsat](https://www.usgs.gov/landsat-missions)
- [NDVI Calculator](https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index)

---

## ❓ Qual Escolher?

**Para o AgroFarmDigital, recomendo:**

1. **Sentinel Hub** (plano gratuito) - Melhor custo-benefício, fácil integração
2. **Google Earth Engine** - Se precisar de análises complexas e histórico longo

Quer que eu implemente a integração com alguma dessas APIs?
