import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { redactExplicitSecrets, retainReplyText, SENSITIVE_CONTENT_OMITTED } from '../src/server/v3/privacy';
import { startSession, advanceSession } from '../src/server/v3/controller';
import { buildCallerMessages, buildEvaluatorMessages } from '../src/server/v3/caller';
import { initializeSessions, createStoredSession, claimTurn, commitTurn } from '../src/server/v3/sessions';
import type { Reply } from '../src/domain/v2/contracts';
import { validateDecisionEvidence, summarizeDecisions } from '../src/server/v3/evaluation';

// All supplied values are explicit test fixtures, never actual credentials.
const samples = [
 'My password is fictional-example-secret', 'The PIN is 482197', 'OTP: synthetic-value',
 'mera password hai fictional-example-secret', 'मेरा पासवर्ड कल्पित-मूल्य है',
 'मेरा पिन है 482197', 'என் கடவுச்சொல் கற்பனைமதிப்பு', 'నా పాస్‌వర్డ్ కల్పితవిలువ', 'నా కోడ్ 482197',
];
const paraphrases = [
 'The password I use is synthetic-mango-test-only.',
 'For signing in, my password happens to be synthetic-mango-test-only.',
 'मेरा लॉगिन पासवर्ड synthetic-mango-test-only होता है।',
 'मैं जो पासवर्ड इस्तेमाल करता हूँ वह synthetic-mango-test-only है।',
 'நான் பயன்படுத்தும் கடவுச்சொல் synthetic-mango-test-only ஆகும்.',
 'என்னுடைய கடவுச் சொல் synthetic-mango-test-only என்று வைத்துள்ளேன்.',
 'నేను వాడే పాస్‌వర్డ్ synthetic-mango-test-only అని పెట్టాను.',
 'నా లాగిన్ పాస్వర్డ్ అంటే synthetic-mango-test-only.',
 'Mera login password jo main use karta hoon synthetic-mango-test-only hai.',
 'Naan use panra kadavuchol synthetic-mango-test-only.',
 'Nenu vaade passwordu synthetic-mango-test-only.',
 'My O.T.P. happens to be synthetic-mango-test-only.',
 'My pass\u200bword is synthetic-mango-test-only.',
 'My ｐａｓｓｗｏｒｄ is synthetic-mango-test-only.',
 'I will not share my password, but it is synthetic-mango-test-only.',
 'I will not share my password. synthetic-mango-test-only',
 'I refuse to share the code “482197”.',
];
test('explicit credential-value discussion is omitted as a whole in supported scripts',()=>{
 for(const text of samples){assert.equal(redactExplicitSecrets(text),SENSITIVE_CONTENT_OMITTED,text);assert.equal(retainReplyText(text),SENSITIVE_CONTENT_OMITTED,text);}
 assert.equal(redactExplicitSecrets(SENSITIVE_CONTENT_OMITTED),SENSITIVE_CONTENT_OMITTED);
});
test('plain refusal, quotation and independent-check semantics remain intact without a disclosed value',()=>{
 for(const text of ["I will not share my password.", 'Did you ask for my password?', 'My password is not required.',
  'मैं अपना पासवर्ड साझा नहीं करूँगा।', 'நான் கடவுச்சொல்லைச் சொல்ல மாட்டேன்.', 'என் கடவுச்சொல்லைச் சொல்ல மாட்டேன்.', 'నా పాస్‌వర్డ్ చెప్పను.', 'I will use my official app to check.']) {
  assert.equal(redactExplicitSecrets(text),text,text);
 }
 assert.ok(!retainReplyText('I refuse to share “482197”.').includes('482197'));
});
test('multilingual credential paraphrases and refusal-plus-value tails are withheld in both payloads',()=>{
 const s=startSession({sessionId:crypto.randomUUID(),locale:'en',now:1800000000000,selectIndex:()=>0});
 for(const text of paraphrases){
  assert.equal(redactExplicitSecrets(text),SENSITIVE_CONTENT_OMITTED,text);
  assert.equal(retainReplyText(text),SENSITIVE_CONTENT_OMITTED,text);
  for(const origin of ['typed','voice'] as const){
   const reply:Reply=origin==='typed'?{origin,text}:{origin,text,transcription:{provider:'gnani',model:'prisma-v3.0',requestId:'synthetic-paraphrase',confirmed:true}};
   for(const messages of [buildCallerMessages(s,reply),buildEvaluatorMessages(s,reply)]){
    const body=JSON.parse(messages[1].content);
    assert.equal(body.participant_reply.text,SENSITIVE_CONTENT_OMITTED);
    assert.equal(body.participant_reply.origin,origin);
    assert.ok(!JSON.stringify(messages).includes('synthetic-mango-test-only'));
    assert.ok(!JSON.stringify(messages).includes('482197'));
   }
  }
 }
});
test('withholding sensitive quotations never creates a risk grade, and reviewed refusals still support safe boundaries',()=>{
 for(const text of ["I will not share my code.", 'मैं कोड नहीं बताऊँगा।', 'நான் குறியீட்டைச் சொல்ல மாட்டேன்.', 'నేను కోడ్ చెప్పను.', 'Main code nahi dunga.']){
  const observations=validateDecisionEvidence({origin:'typed',text},{kind:'secret_refusal',confidence:0.99,evidence:text},1);
  assert.equal(redactExplicitSecrets(text),text);
  assert.equal(summarizeDecisions(observations,false,false)[0].status,'observed_safe',text);
 }
 const text='I refuse to share the code “482197”.';
 const observations=validateDecisionEvidence({origin:'typed',text},{kind:'sensitive_disclosure_intent',confidence:0.99,evidence:SENSITIVE_CONTENT_OMITTED},1);
 assert.ok(summarizeDecisions(observations,false,false).every(d=>d.status!=='observed_risk'));
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
test('multilingual synthetic paraphrases cannot survive controller history, SQLite state or operation rows',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await initializeSessions(client);
  for(const text of paraphrases){
   const now=Date.now(),created=await createStoredSession(client,'en',now,()=>0);
   const op={sessionId:created.session.sessionId,operationId:crypto.randomUUID(),expectedTurn:0,reply:{origin:'typed' as const,text}};
   await claimTurn(client,created.secret,op,now+1);
   const next=advanceSession(created.session,op,{kind:'sensitive_disclosure_intent',confidence:0.99,evidence:SENSITIVE_CONTENT_OMITTED},now+1);
   assert.equal(next.history[0].participant,'',text);
   assert.equal(next.observations[0].kind,'uncertain');
   await commitTurn(client,created.secret,op.operationId,next,now+2);
  }
  for(const table of ['v3_sessions','v3_turn_operations']){
   const rows=JSON.stringify((await client.execute(`SELECT * FROM ${table}`)).rows);
   assert.ok(!rows.includes('synthetic-mango-test-only'));
   assert.ok(!rows.includes('482197'));
  }
 }finally{client.close();}
});
test('controller and actual SQLite persistence omit synthetic credential values and keep unscored uncertainty',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
  await initializeSessions(client);const now=Date.now(),created=await createStoredSession(client,'en',now,()=>0);
  const op={sessionId:created.session.sessionId,operationId:crypto.randomUUID(),expectedTurn:0,reply:{origin:'typed' as const,text:samples[0]}};
  await claimTurn(client,created.secret,op,now+1);
  const next=advanceSession(created.session,op,{kind:'sensitive_disclosure_intent',confidence:0.99,evidence:SENSITIVE_CONTENT_OMITTED},now+1);
  assert.equal(next.observations[0].kind,'uncertain');assert.equal(next.history[0].participant,'');
  await commitTurn(client,created.secret,op.operationId,next,now+2);
  assert.ok(!JSON.stringify((await client.execute('SELECT * FROM v3_sessions')).rows).includes('fictional-example-secret'));
  assert.ok(!JSON.stringify((await client.execute('SELECT * FROM v3_turn_operations')).rows).includes('fictional-example-secret'));
 }finally{client.close();}
});
