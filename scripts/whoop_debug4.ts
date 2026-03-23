import * as whoopDb from '../server/whoopDb';
import * as whoopCrypto from '../server/whoopCrypto';

const USER_OPEN_ID = '8930fb54-6d2b-4ffe-9b74-8a42fa861dcb';
const WHOOP_API_BASE = 'https://api.prod.whoop.com';

async function whoopGet(token: string, path: string) {
  const response = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`GET ${path} -> ${response.status}`);
  const body = await response.text();
  console.log('Body:', body.slice(0, 2000));
}

async function main() {
  const stored = await whoopDb.getWhoopTokens(USER_OPEN_ID);
  if (!stored) { process.exit(1); }
  const token = whoopCrypto.decryptToken(stored.accessToken);
  
  // Try recovery with a much wider window (90 days, no end date)
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await whoopGet(token, `/developer/v1/recovery?start=${start}&limit=5`);
  
  // Try sleep with a much wider window
  await whoopGet(token, `/developer/v1/activity/sleep?start=${start}&limit=5`);
  
  // Try recovery by cycle ID (previous completed cycle: 1382813110)
  await whoopGet(token, `/developer/v1/cycle/1382813110/recovery`);
  
  process.exit(0);
}
main().catch(console.error);
