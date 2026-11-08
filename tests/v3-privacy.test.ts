import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { redactExplicitSecrets, retainReplyText, SENSITIVE_CONTENT_OMITTED } from '../src/server/v3/privacy';
import { startSession, advanceSession } from '../src/server/v3/controller';
import { buildCallerMessages, buildEvaluatorMessages } from '../src/server/v3/caller';
import { initializeSessions, createStoredSession, claimTurn, commitTurn } from '../src/server/v3/sessions';
import type { Reply } from '../src/domain/v2/contracts';

// All supplied values are explicit test fixtures, never actual credentials.
const samples = [
 'My password is fictional-example-secret', 'The PIN is 482197', 'OTP: synthetic-value',
 'mera password hai fictional-example-secret', 'मेरा पासवर्ड कल्पित-मूल्य है',
 'मेरा पिन है 482197', 'என் கடவுச்சொல் கற்பனைமதிப்பு', 'నా పాస్‌వర్డ్ కల్పితవిలువ', 'నా కోడ్ 482197',
];
test('explicit credential-value discussion is omitted as a whole in supported scripts',()=>{
 for(const text of samples){assert.equal(redactExplicitSecrets(text),SENSITIVE_CONTENT_OMITTED,text);assert.equal(retainReplyText(text),SENSITIVE_CONTENT_OMITTED,text);}
 assert.equal(redactExplicitSecrets(SENSITIVE_CONTENT_OMITTED),SENSITIVE_CONTENT_OMITTED);
});
test('plain refusal, quotation and independent-check semantics remain intact without a disclosed value',()=>{
 for(const text of ["I will not share my password.", 'Did you ask for my password?', 'My password is not required.', 'I refuse to share the code “482197”.',
  'मैं अपना पासवर्ड साझा नहीं करूँगा।', 'நான் கடவுச்சொல்லைச் சொல்ல மாட்டேன்.', 'என் கடவுச்சொல்லைச் சொல்ல மாட்டேன்.', 'నా పాస్‌వర్డ్ చెప్పను.', 'I will use my official app to check.']) {
  assert.equal(redactExplicitSecrets(text),text,text);
 }
 assert.ok(!retainReplyText('I refuse to share “482197”.').includes('482197'));
});
test('caller and evaluator never receive an explicit credential value; provenance is retained',()=>{
 const s=startSession({sessionId:crypto.randomUUID(),locale:'en',now:1800000000000,selectIndex:()=>0});
 for(const origin of ['typed','voice'] as const){
  const r:Reply=origin==='typed'?{origin,text:samples[0]}:{origin,text:samples[0],transcription:{provider:'gnani',model:'prisma-v3.0',requestId:'explicit-fixture',confirmed:true}};
  for(const messages of [buildCallerMessages(s,r),buildEvaluatorMessages(s,r)]){
   assert.ok(!JSON.stringify(messages).includes('fictional-example-secret'));
   const body=JSON.parse(messages[1].content);assert.equal(body.participant_reply.origin,origin);assert.equal(body.participant_reply.text,SENSITIVE_CONTENT_OMITTED);
  }
 }
});
test('controller and actual SQLite persistence omit synthetic credential values and keep unscored uncertainty',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await initializeSessions(client);const now=Date.now(),created=await createStoredSession(client,'en',now,()=>0);
  const op={sessionId:created.session.sessionId,operationId:crypto.randomUUID(),expectedTurn:0,reply:{origin:'typed' as const,text:samples[0]}};
  await claimTurn(client,created.secret,op,now+1);
  const next=advanceSession(created.session,op,{kind:'sensitive_disclosure_intent',confidence:0.99,evidence:SENSITIVE_CONTENT_OMITTED},now+1);
  assert.equal(next.observations[0].kind,'uncertain');assert.equal(next.history[0].participant,SENSITIVE_CONTENT_OMITTED);
  await commitTurn(client,created.secret,op.operationId,next,now+2);
  assert.ok(!JSON.stringify((await client.execute('SELECT * FROM v3_sessions')).rows).includes('fictional-example-secret'));
  assert.ok(!JSON.stringify((await client.execute('SELECT * FROM v3_turn_operations')).rows).includes('fictional-example-secret'));
 }finally{client.close();}
});
