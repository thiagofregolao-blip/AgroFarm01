import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

// Load environment variables
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/agrofarm';

const sql = postgres(DATABASE_URL);

const BACKUP_DIR = './backup_banco_dados';

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',');
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Handle CSV with potential commas in quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, idx) => {
      let val = values[idx] || '';
      // Handle empty values
      if (val === '' || val === 'null' || val === 'NULL') {
        val = null;
      }
      row[header] = val;
    });
    rows.push(row);
  }
  
  return rows;
}

function readCSV(filename) {
  const filePath = path.join(BACKUP_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseCSV(content);
}

async function clearTables() {
  console.log('🗑️  Clearing existing data...');
  await sql`DELETE FROM sales`;
  await sql`DELETE FROM user_client_links`;
  await sql`DELETE FROM master_clients`;
  await sql`DELETE FROM products`;
  await sql`DELETE FROM categories`;
  await sql`DELETE FROM season_goals`;
  await sql`DELETE FROM season_parameters`;
  await sql`DELETE FROM seasons`;
  await sql`DELETE FROM users`;
  await sql`DELETE FROM regions`;
  console.log('✅ Tables cleared');
}

async function importRegions() {
  console.log('📍 Extracting and importing regions from clients...');
  
  // Read clients to extract region IDs
  const clients = readCSV('master_clients.csv');
  const regionIds = [...new Set(clients.map(c => c.region_id).filter(Boolean))];
  
  console.log(`   Found ${regionIds.length} unique regions`);
  
  for (const regionId of regionIds) {
    // Create region with the same ID
    let name = 'Região ' + regionId.substring(0, 8);
    if (regionId.startsWith('reg-')) {
      name = regionId.replace('reg-', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    try {
      await sql`
        INSERT INTO regions (id, name, country)
        VALUES (${regionId}, ${name}, 'Paraguai')
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e) {
      console.log(`   Warning: Could not create region ${regionId}: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${regionIds.length} regions`);
}

async function importUsers() {
  console.log('👥 Importing users...');
  const users = readCSV('users.csv');
  let count = 0;
  
  for (const user of users) {
    try {
      await sql`
        INSERT INTO users (id, username, password, name, role, manager_id)
        VALUES (
          ${user.id},
          ${user.username},
          ${user.password},
          ${user.name},
          ${user.role},
          ${user.manager_id || null}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import user ${user.username}: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} users`);
}

async function importCategories() {
  console.log('📦 Importing categories...');
  const categories = readCSV('categories.csv');
  let count = 0;
  
  for (const cat of categories) {
    try {
      await sql`
        INSERT INTO categories (id, name, type, green_commission, green_margin_min, yellow_commission, yellow_margin_min, yellow_margin_max, red_commission, red_margin_min, red_margin_max, below_list_commission, default_iva)
        VALUES (
          ${cat.id},
          ${cat.name},
          ${cat.type},
          ${parseFloat(cat.green_commission) || 0},
          ${parseFloat(cat.green_margin_min) || 0},
          ${parseFloat(cat.yellow_commission) || 0},
          ${parseFloat(cat.yellow_margin_min) || 0},
          ${parseFloat(cat.yellow_margin_max) || 0},
          ${parseFloat(cat.red_commission) || 0},
          ${parseFloat(cat.red_margin_min) || 0},
          ${parseFloat(cat.red_margin_max) || 0},
          ${parseFloat(cat.below_list_commission) || 0},
          ${parseFloat(cat.default_iva) || 10}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import category ${cat.name}: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} categories`);
}

async function importSeasons() {
  console.log('📅 Importing seasons...');
  const seasons = readCSV('seasons.csv');
  let count = 0;
  
  for (const season of seasons) {
    try {
      await sql`
        INSERT INTO seasons (id, name, type, year, start_date, end_date, is_active)
        VALUES (
          ${season.id},
          ${season.name},
          ${season.type},
          ${parseInt(season.year)},
          ${season.start_date},
          ${season.end_date},
          ${season.is_active === 't' || season.is_active === 'true'}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import season ${season.name}: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} seasons`);
}

async function importProducts() {
  console.log('🏷️  Importing products...');
  const products = readCSV('products.csv');
  let count = 0;
  
  for (const prod of products) {
    try {
      await sql`
        INSERT INTO products (id, name, category_id, description, is_active, subcategory_id, marca, package_size, segment, timac_points)
        VALUES (
          ${prod.id},
          ${prod.name},
          ${prod.category_id || null},
          ${prod.description || null},
          ${prod.is_active === 't' || prod.is_active === 'true'},
          ${prod.subcategory_id || null},
          ${prod.marca || null},
          ${prod.package_size ? parseFloat(prod.package_size) : null},
          ${prod.segment || null},
          ${prod.timac_points ? parseFloat(prod.timac_points) : 0}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import product ${prod.name}: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} products`);
}

async function importMasterClients() {
  console.log('🧑‍🌾 Importing master clients...');
  const clients = readCSV('master_clients.csv');
  let count = 0;
  
  for (const client of clients) {
    try {
      await sql`
        INSERT INTO master_clients (id, name, region_id, planting_area, cultures, is_active, created_at, updated_at, credit_line)
        VALUES (
          ${client.id},
          ${client.name},
          ${client.region_id || null},
          ${client.planting_area ? parseFloat(client.planting_area) : null},
          ${client.cultures || '[]'},
          ${client.is_active === 't' || client.is_active === 'true'},
          ${client.created_at || new Date().toISOString()},
          ${client.updated_at || new Date().toISOString()},
          ${client.credit_line ? parseFloat(client.credit_line) : null}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import client ${client.name}: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} master clients`);
}

async function importUserClientLinks() {
  console.log('🔗 Importing user-client links...');
  const links = readCSV('user_client_links.csv');
  let count = 0;
  
  for (const link of links) {
    try {
      await sql`
        INSERT INTO user_client_links (id, user_id, master_client_id, custom_name, planting_area, cultures, planting_progress, is_top80_20, is_active, created_at, credit_limit, include_in_market_area)
        VALUES (
          ${link.id},
          ${link.user_id},
          ${link.master_client_id},
          ${link.custom_name || null},
          ${link.planting_area ? parseFloat(link.planting_area) : null},
          ${link.cultures || null},
          ${link.planting_progress ? parseFloat(link.planting_progress) : 0},
          ${link.is_top80_20 === 't' || link.is_top80_20 === 'true'},
          ${link.is_active === 't' || link.is_active === 'true'},
          ${link.created_at || new Date().toISOString()},
          ${link.credit_limit ? parseFloat(link.credit_limit) : null},
          ${link.include_in_market_area === 't' || link.include_in_market_area === 'true'}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import link: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} user-client links`);
}

async function importSales() {
  console.log('💰 Importing sales (this may take a while)...');
  const sales = readCSV('sales.csv');
  let count = 0;
  let errors = 0;
  
  for (const sale of sales) {
    try {
      await sql`
        INSERT INTO sales (id, client_id, product_id, category_id, season_id, user_id, sale_date, due_date, total_amount, margin, iva_rate, commission_rate, commission_amount, commission_tier, is_manual, pdf_file_name, created_at, import_batch_id, quantity, timac_points, order_code)
        VALUES (
          ${sale.id},
          ${sale.client_id || null},
          ${sale.product_id || null},
          ${sale.category_id || null},
          ${sale.season_id || null},
          ${sale.user_id || null},
          ${sale.sale_date || null},
          ${sale.due_date || null},
          ${sale.total_amount ? parseFloat(sale.total_amount) : 0},
          ${sale.margin ? parseFloat(sale.margin) : 0},
          ${sale.iva_rate ? parseFloat(sale.iva_rate) : 10},
          ${sale.commission_rate ? parseFloat(sale.commission_rate) : 0},
          ${sale.commission_amount ? parseFloat(sale.commission_amount) : 0},
          ${sale.commission_tier || null},
          ${sale.is_manual === 't' || sale.is_manual === 'true'},
          ${sale.pdf_file_name || null},
          ${sale.created_at || new Date().toISOString()},
          ${sale.import_batch_id || null},
          ${sale.quantity ? parseFloat(sale.quantity) : 0},
          ${sale.timac_points ? parseFloat(sale.timac_points) : null},
          ${sale.order_code || null}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
      if (count % 100 === 0) {
        process.stdout.write(`   Progress: ${count}/${sales.length}\r`);
      }
    } catch (e) {
      errors++;
    }
  }
  
  console.log(`\n✅ Imported ${count} sales (${errors} errors)`);
}

async function importSeasonGoals() {
  console.log('🎯 Importing season goals...');
  const goals = readCSV('season_goals.csv');
  let count = 0;
  
  for (const goal of goals) {
    try {
      await sql`
        INSERT INTO season_goals (id, season_id, user_id, category_id, target_value, created_at)
        VALUES (
          ${goal.id},
          ${goal.season_id},
          ${goal.user_id},
          ${goal.category_id || null},
          ${goal.target_value ? parseFloat(goal.target_value) : 0},
          ${goal.created_at || new Date().toISOString()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      count++;
    } catch (e) {
      console.log(`   Warning: Could not import season goal: ${e.message}`);
    }
  }
  
  console.log(`✅ Imported ${count} season goals`);
}

async function main() {
  console.log('🚀 Starting database import from backup...\n');
  
  try {
    await clearTables();
    await importRegions();
    await importUsers();
    await importCategories();
    await importSeasons();
    await importProducts();
    await importMasterClients();
    await importUserClientLinks();
    await importSales();
    await importSeasonGoals();
    
    console.log('\n🎉 Import completed successfully!');
  } catch (e) {
    console.error('❌ Import failed:', e);
  } finally {
    await sql.end();
  }
}

main();
