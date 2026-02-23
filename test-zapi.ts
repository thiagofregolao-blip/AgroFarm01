import { ZApiClient } from './server/whatsapp/zapi-client';
import * as dotenv from 'dotenv';
dotenv.config();

const zapi = new ZApiClient({
  instanceId: process.env.ZAPI_INSTANCE_ID || '3EE9E067CA2DB1B055091AD735EF201A',
  token: process.env.ZAPI_TOKEN || '04B2338260C41E1C2EDA1FF2',
  clientToken: process.env.ZAPI_CLIENT_TOKEN
});

async function run() {
  console.log('Sending test message format 1...');
  const res1 = await zapi.sendTextMessage({
    phone: '595986848326',
    message: 'Alo Sergio! Isso eh um teste do sistema AgroFarm. Z-API respondeu sucesso.',
    isGroup: false
  });
  console.log('Test 1:', res1);

  process.exit(0);
}
run();
