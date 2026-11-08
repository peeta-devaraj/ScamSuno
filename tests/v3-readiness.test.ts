import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { initializeLedger,setPolicy,usageSummary,type UsagePolicy } from '../src/server/v2/ledger';
import { budgetReadiness } from '../src/server/v3/readiness';
test('keys alone do not imply readiness; closed, exhausted and partial voice budgets remain honest',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await initializeLedger(client);let s=await usageSummary(client,Date.now());
  assert.deepEqual(budgetReadiness(s,true),{available:false,voiceAvailable:false});
  const now=Date.now();const p:UsagePolicy={enabled:true,killSwitch:false,reconciledAt:now,expiresAt:now+60000,verifiedCreditFloor:4986,reserveCredits:1000,maxGnaniRequests:3,maxGnaniRequestsPerDay:3,maxLLMRequests:2,maxLLMRequestsPerDay:2,maxRequestsPerSession:10,maxConcurrent:1,maxSTTSeconds:15,maxTTSChars:420};
  await setPolicy(client,p);s=await usageSummary(client,now);
  assert.deepEqual(budgetReadiness(s,true),{available:true,voiceAvailable:true});
  assert.deepEqual(budgetReadiness(s,false),{available:true,voiceAvailable:false});
  s.counters.gnani.daily=1;assert.deepEqual(budgetReadiness(s,true),{available:true,voiceAvailable:false});
  s.counters.llm.daily=1;assert.deepEqual(budgetReadiness(s,true),{available:false,voiceAvailable:false});
  s.counters.llm.daily=0;s.admissionOpen=false;assert.deepEqual(budgetReadiness(s,true),{available:false,voiceAvailable:false});
 }finally{client.close();}
});
