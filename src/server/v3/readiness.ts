import { readUsageAdmission } from '../v2/ledger';
import { databaseWrite } from '../v2/database';
import { liveTrustOrTrapMode } from './config';
import { liveV3VoiceMode } from './speech';
import { v3Database } from './runtime';
import { v3EnabledInTransaction } from './control';
import { budgetReadiness } from './budget';

export { budgetReadiness } from './budget';

/** Display readiness is advisory; transactional provider admission remains authoritative. */
export async function v3Readiness(){
 if(!liveTrustOrTrapMode())return {available:false,voiceAvailable:false};
 try {
  return await databaseWrite(await v3Database(), async tx => {
   if (!await v3EnabledInTransaction(tx)) return { available: false, voiceAvailable: false };
   return budgetReadiness(await readUsageAdmission(tx, Date.now()), Boolean(liveV3VoiceMode()));
  });
 }
 catch{return {available:false,voiceAvailable:false};}
}
