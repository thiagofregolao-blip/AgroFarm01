import fs from 'fs';
import path from 'path';

const whatsappServicePath = path.join('/Volumes/KINGSTON/Desktop/AgroFarmDigital/AgroFarmDigital/server/whatsapp/whatsapp-service.ts');
let content = fs.readFileSync(whatsappServicePath, 'utf8');

// Update to fetch managerId
content = content.replace(
  `SELECT id, name, whatsapp_number FROM users WHERE`,
  `SELECT id, name, manager_id, whatsapp_number FROM users WHERE`
);

content = content.replace(
  `SELECT id, name, whatsapp_number FROM users WHERE`,
  `SELECT id, name, manager_id, whatsapp_number FROM users WHERE`
);

// Map managerId into the user return
content = content.replace(
  `return { id: userResult.rows[0].id, name: userResult.rows[0].name };`,
  `return { id: userResult.rows[0].manager_id || userResult.rows[0].id, name: userResult.rows[0].name };`
);

content = content.replace(
  `return { id: userResult[0].id, name: userResult[0].name };`,
  `return { id: userResult[0].manager_id || userResult[0].id, name: userResult[0].name };`
);

fs.writeFileSync(whatsappServicePath, content);
console.log('Updated whatsapp-service.ts to use managerId');
