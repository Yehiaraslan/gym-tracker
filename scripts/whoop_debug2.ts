import * as whoopDb from '../server/whoopDb';
import * as whoopCrypto from '../server/whoopCrypto';

const USER_OPEN_ID = '8930fb54-6d2b-4ffe-9b74-8a42fa861dcb';
const WHOOP_API_BASE = 'https://api.prod.whoop.com';

async function whoopGet(token: string, path: string) {
  const response = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`GET ${path} -> ${response.status}`);
  if (!response.ok) {
    const body = await response.text();
    console.log('Error body:', body.slice(0, 500));
    return null;
  }
  return response.json();
}

async function main() {
  const stored = await whoopDb.getWhoopTokens(USER_OPEN_ID);
  if (!stored) { console.log('No token'); process.exit(1); }
  
  const token = whoopCrypto.decryptToken(stored.accessToken);
  
  // Try without any date filter - just get latest records
  console.log('\n--- Recovery (no date filter, limit=3) ---');
  const r1 = await whoopGet(token, '/developer/v1/recovery?limit=3');
  console.log(JSON.stringify(r1, null, 2)?.slice(0, 2000));
  
  // Try sleep without date filter
  console.log('\n--- Sleep (no date filter, limit=3) ---');
  const s1 = await whoopGet(token, '/developer/v1/activity/sleep?limit=3');
  console.log(JSON.stringify(s1, null, 2)?.slice(0, 2000));
  
  // Try with wider date range (30 days)
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`\n--- Recovery (30 days: ${start} to ${end}) ---`);
  const r2 = await whoopGet(token, `/developer/v1/recovery?start=${start}&end=${end}&limit=5`);
  console.log(JSON.stringify(r2, null, 2)?.slice(0, 2000));

  process.exit(0);
}
main().catch(console.error);
