import { usageSummary,type UsageSummary } from '../v2/ledger';
import { liveTrustOrTrapMode } from './config';
import { liveV3VoiceMode } from './speech';
import { v3Database } from './runtime';
import { v3AdmissionEnabled } from './control';

/** Display readiness is advisory; transactional provider admission remains authoritative. */
export function budgetReadiness(summary:UsageSummary,voiceConfigured:boolean){
 const p=summary.policy,c=summary.counters;
 const available=Boolean(summary.admissionOpen&&p&&c.active<p.maxConcurrent&&
  p.maxLLMRequests-c.llm.totalSinceReconciliation>=2&&p.maxLLMRequestsPerDay-c.llm.daily>=2);
 // One opening, transcription and response is the smallest complete voice exchange.
 const voiceAvailable=Boolean(available&&voiceConfigured&&p&&p.maxGnaniRequests-c.gnani.totalSinceReconciliation>=3&&p.maxGnaniRequestsPerDay-c.gnani.daily>=3);
 return {available,voiceAvailable};
}
export async function v3Readiness(){
 if(!liveTrustOrTrapMode())return {available:false,voiceAvailable:false};
 try{const client=await v3Database();if(!await v3AdmissionEnabled(client))return {available:false,voiceAvailable:false};return budgetReadiness(await usageSummary(client,Date.now()),Boolean(liveV3VoiceMode()));}
 catch{return {available:false,voiceAvailable:false};}
}
