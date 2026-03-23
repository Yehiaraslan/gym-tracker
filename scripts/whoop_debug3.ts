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
  console.log('Body:', body.slice(0, 1000));
  return response.status;
}

async function main() {
  const stored = await whoopDb.getWhoopTokens(USER_OPEN_ID);
  if (!stored) { console.log('No token'); process.exit(1); }
  const token = whoopCrypto.decryptToken(stored.accessToken);
  console.log('Token (first 20 chars):', token.slice(0, 20));
  
  await whoopGet(token, '/developer/v1/user/profile/basic');
  await whoopGet(token, '/developer/v1/cycle?limit=3');
  await whoopGet(token, '/developer/v1/recovery?limit=3');
  await whoopGet(token, '/developer/v1/activity/sleep?limit=3');
  process.exit(0);
}
main().catch(console.error);
