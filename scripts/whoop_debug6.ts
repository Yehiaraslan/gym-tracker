import * as whoopDb from '../server/whoopDb';
import * as whoopCrypto from '../server/whoopCrypto';

const USER_OPEN_ID = '8930fb54-6d2b-4ffe-9b74-8a42fa861dcb';
const WHOOP_API_BASE = 'https://api.prod.whoop.com';

async function whoopGet(token: string, path: string) {
  const r = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.text();
  console.log(`${r.status} ${path}`);
  if (r.ok) console.log(body.slice(0, 1500));
  else console.log('ERR:', body.slice(0, 200));
  return r.ok ? JSON.parse(body) : null;
}

async function main() {
  const stored = await whoopDb.getWhoopTokens(USER_OPEN_ID);
  if (!stored) { process.exit(1); }
  const token = whoopCrypto.decryptToken(stored.accessToken);
  
  // Get cycles first to find cycle IDs
  const cycles = await whoopGet(token, '/developer/v1/cycle?limit=5');
  if (cycles?.records) {
    for (const c of cycles.records) {
      console.log(`\nCycle ${c.id}: start=${c.start}, end=${c.end ?? 'OPEN'}, state=${c.score_state}`);
      // Try to get recovery for each cycle
      await whoopGet(token, `/developer/v1/cycle/${c.id}/recovery`);
      // Try sleep for the cycle
      await whoopGet(token, `/developer/v1/activity/sleep?cycle_id=${c.id}`);
    }
  }
  process.exit(0);
}
main().catch(console.error);
