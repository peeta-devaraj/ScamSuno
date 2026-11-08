import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startSession,buildDebrief } from '../src/server/v3/controller';
import { prepareConversationTurn } from '../src/server/v3/conversation';
import type { ConversationGateway } from '../src/server/v2/caller';

test('all three scenarios complete bounded multi-turn text preparation through the reused gateway contract',async()=>{
 for(const locale of ['en','hi','ta','te'] as const)for(const index of [0,1,2]){
  let s=startSession({sessionId:randomUUID(),locale,now:1800000000000,selectIndex:()=>index});let calls=0;
  const captions={en:'What else would you like to understand about this notice?',hi:'इस सूचना के बारे में आप और क्या समझना चाहेंगे?',ta:'இந்தச் செய்தியைப் பற்றி மேலும் என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?',te:'ఈ సమాచారం గురించి ఇంకా ఏమి తెలుసుకోవాలనుకుంటున్నారు?'};
  const gateway:ConversationGateway={async execute(r){calls++;const input=JSON.parse(r.messages[1].content);return JSON.stringify(r.purpose==='evaluator'?{kind:'uncertainty_recognized',confidence:0,evidence:input.participant_reply.text}:{locale,text:captions[locale],action:'continue'});}};
  const first=await prepareConversationTurn(s,{sessionId:s.sessionId,operationId:randomUUID(),expectedTurn:0,reply:{origin:'typed',text:'Who are you?'}},gateway,{source:'fixture',now:s.updatedAt+1,assertActive:async()=>{}});
  s=first.session;assert.equal(s.turn,1);assert.equal(calls,2);assert.equal(first.callerSource,'fixture');
  const ended=await prepareConversationTurn(s,{sessionId:s.sessionId,operationId:randomUUID(),expectedTurn:1,reply:{origin:'button',id:'end'}},gateway,{source:'fixture',now:s.updatedAt+1,assertActive:async()=>{}});
  assert.equal(ended.session.ending,'participant');assert.equal(calls,2);assert.equal(buildDebrief(ended.session).decisions.at(-1)?.status,'observed_safe');
 }
});
test('End winning during evaluation prevents caller dispatch; errors and unsafe output use honest fallbacks',async()=>{
 const s=startSession({sessionId:randomUUID(),locale:'en',now:Date.now(),selectIndex:()=>0});
 const op={sessionId:s.sessionId,operationId:randomUUID(),expectedTurn:0,reply:{origin:'typed' as const,text:'Hello'}};
 let active=true,calls=0;
 await assert.rejects(prepareConversationTurn(s,op,{async execute(){calls++;active=false;return '{}';}},{source:'fixture',now:s.updatedAt,assertActive:async()=>{if(!active)throw Error('LEASE_LOST');}}));assert.equal(calls,1);
 const failed=await prepareConversationTurn(s,op,{async execute(){throw Error('fixture-unavailable');}},{source:'fixture',now:s.updatedAt,assertActive:async()=>{}});assert.equal(failed.status,'evaluation_unavailable');assert.equal(failed.session.turn,0);
 const unsafe=await prepareConversationTurn(s,op,{async execute(r){return JSON.stringify(r.purpose==='evaluator'?{}:{locale:'en',text:'Share your password.',action:'continue'});}},{source:'fixture',now:s.updatedAt,assertActive:async()=>{}});assert.equal(unsafe.callerSource,'authored_fallback');assert.equal(unsafe.status,'caller_fallback');
});
