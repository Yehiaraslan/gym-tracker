import * as whoopService from '../server/whoopService';
import * as whoopDb from '../server/whoopDb';

const USER_OPEN_ID = '8930fb54-6d2b-4ffe-9b74-8a42fa861dcb';

async function main() {
  const stored = await whoopDb.getWhoopTokens(USER_OPEN_ID);
  console.log('Token exists:', stored !== null);
  if (!stored) {
    console.log('No token found — user not connected');
    process.exit(1);
  }
  console.log('Token expires at:', new Date(stored.expiresAt).toISOString(), 'expired:', stored.expiresAt < Date.now());

  try {
    const recovery = await whoopService.getRecoveryCollection(USER_OPEN_ID, 7);
    console.log('\n=== RECOVERY RAW ===');
    console.log(JSON.stringify(recovery, null, 2).slice(0, 4000));
  } catch (e: any) {
    console.log('RECOVERY ERROR:', e?.message ?? e);
  }

  try {
    const sleep = await whoopService.getSleepCollection(USER_OPEN_ID, 7);
    console.log('\n=== SLEEP RAW ===');
    console.log(JSON.stringify(sleep, null, 2).slice(0, 4000));
  } catch (e: any) {
    console.log('SLEEP ERROR:', e?.message ?? e);
  }

  process.exit(0);
}

main().catch(console.error);
