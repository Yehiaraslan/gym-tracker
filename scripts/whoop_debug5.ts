import * as whoopDb from '../server/whoopDb';
import * as whoopCrypto from '../server/whoopCrypto';

const USER_OPEN_ID = '8930fb54-6d2b-4ffe-9b74-8a42fa861dcb';
const WHOOP_API_BASE = 'https://api.prod.whoop.com';

async function main() {
  const stored = await whoopDb.getWhoopTokens(USER_OPEN_ID);
  if (!stored) { process.exit(1); }
  
  console.log('Stored scope:', stored.scope);
  console.log('Expires at:', new Date(stored.expiresAt).toISOString());
  
  const token = whoopCrypto.decryptToken(stored.accessToken);
  
  // Check token introspection / what the token actually allows
  // Try the /developer/v1/user/profile/basic to confirm token works
  const r = await fetch(`${WHOOP_API_BASE}/developer/v1/user/profile/basic`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Profile status:', r.status);
  
  // Check what scopes WHOOP granted by looking at the token response
  // Try /oauth/token/introspect if available
  const r2 = await fetch(`${WHOOP_API_BASE}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
  });
  console.log('Introspect status:', r2.status, await r2.text().then(t => t.slice(0, 500)));
  
  process.exit(0);
}
main().catch(console.error);
