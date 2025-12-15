import { db, dbReady } from './db';
import * as schema from '@shared/schema';

async function seed() {
  console.log('🌱 Seeding database...');
  
  // Aguarda o banco estar pronto
  await dbReady;

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
      greenCommission: "1.50",
      greenMarginMin: "16.00",
      yellowCommission: "1.00",
      yellowMarginMin: "13.00",
      yellowMarginMax: "15.99",
      redCommission: "0.50",
      redMarginMin: "10.00",
      redMarginMax: "12.99",
      belowListCommission: "0.25",
      defaultIva: "10.00",
    },
    {
      id: "cat-sem-milho",
      name: "Sementes Milho",
      type: "sementes",
      greenCommission: "2.50",
      greenMarginMin: "25.00",
      yellowCommission: "1.70",
      yellowMarginMin: "20.00",
      yellowMarginMax: "24.99",
      redCommission: "1.00",
      redMarginMin: "15.00",
      redMarginMax: "19.99",
      belowListCommission: "0.50",
      defaultIva: "10.00",
    },
    {
      id: "cat-sem-soja",
      name: "Sementes Soja",
      type: "sementes",
      greenCommission: "3.50",
      greenMarginMin: "25.00",
      yellowCommission: "2.50",
      yellowMarginMin: "20.00",
      yellowMarginMax: "24.99",
      redCommission: "2.00",
      redMarginMin: "15.00",
      redMarginMax: "19.99",
      belowListCommission: "1.00",
      defaultIva: "10.00",
    },
    {
      id: "cat-especialidades",
      name: "Especialidades",
      type: "especialidades",
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
    {
      id: "cat-corretivos",
      name: "Corretivos",
      type: "corretivos",
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
  ];

  const regionData = [
    { id: "reg-alto-parana", name: "Alto Paraná", country: "Paraguay" },
    { id: "reg-itapua", name: "Itapúa", country: "Paraguay" },
    { id: "reg-canindeyu", name: "Canindeyú", country: "Paraguay" },
    { id: "reg-caaguazu", name: "Caaguazú", country: "Paraguay" },
  ];

  const seasonParamData = [
    {
      id: "sp-soja-verao",
      type: "soja_verao" as const,
      dueDateMonth: 3,
      dueDateDay: 30,
      labelPattern: "Soja {year}/{next_year}",
    },
    {
      id: "sp-soja-verao-alt",
      type: "soja_verao" as const,
      dueDateMonth: 4,
      dueDateDay: 30,
      labelPattern: "Soja {year}/{next_year}",
    },
    {
      id: "sp-soja-safrinha",
      type: "soja_safrinha" as const,
      dueDateMonth: 6,
      dueDateDay: 30,
      labelPattern: "Soja Safrinha {year}",
    },
    {
      id: "sp-milho",
      type: "milho" as const,
      dueDateMonth: 8,
      dueDateDay: 30,
      labelPattern: "Milho {year}/{year}",
    },
    {
      id: "sp-trigo",
      type: "trigo" as const,
      dueDateMonth: 10,
      dueDateDay: 30,
      labelPattern: "Trigo {year}",
    },
  ];

  try {
    const existingCategories = await db.select().from(schema.categories);
    if (existingCategories.length === 0) {
      console.log('  📦 Inserting categories...');
      await db.insert(schema.categories).values(categoryData);
      console.log(`  ✅ Inserted ${categoryData.length} categories`);
    } else {
      console.log(`  ℹ️  Categories already exist (${existingCategories.length}), skipping...`);
    }

    const existingRegions = await db.select().from(schema.regions);
    if (existingRegions.length === 0) {
      console.log('  🗺️  Inserting regions...');
      await db.insert(schema.regions).values(regionData);
      console.log(`  ✅ Inserted ${regionData.length} regions`);
    } else {
      console.log(`  ℹ️  Regions already exist (${existingRegions.length}), skipping...`);
    }

    const existingParams = await db.select().from(schema.seasonParameters);
    if (existingParams.length === 0) {
      console.log('  📅 Inserting season parameters...');
      await db.insert(schema.seasonParameters).values(seasonParamData);
      console.log(`  ✅ Inserted ${seasonParamData.length} season parameters`);
    } else {
      console.log(`  ℹ️  Season parameters already exist (${existingParams.length}), skipping...`);
    }

    console.log('✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
