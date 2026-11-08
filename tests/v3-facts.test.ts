import test from 'node:test';
import assert from 'node:assert/strict';
import { startSession,advanceSession,attachCaller,buildDebrief,endSession } from '../src/server/v3/controller';
import { approvedResponses } from '../src/server/v3/approved-dialogue';
import { getScenario } from '../src/server/v3/scenarios';

test('contradiction, negation, invented evidence and suffixes cannot enter any scenario in four languages',()=>{
 const examples={en:['There is no service update in the app.','The branch manager has approved this offer.','The source of this notice is established.'],hi:['ऐप में कोई सेवा सूचना नहीं है।','शाखा प्रबंधक ने अनुमति दी है।','इस संदेश का स्रोत स्थापित है।'],ta:['செயலியில் சேவைச் செய்தி இல்லை.','கிளை மேலாளர் அனுமதி கொடுத்தார்.','இந்தச் செய்தியின் மூலம் தெரியும்.'],te:['యాప్‌లో సేవా సమాచారం లేదు.','శాఖ మేనేజర్ అనుమతి ఇచ్చారు.','ఈ సందేశం మూలం తెలుసు.']};
 for(const locale of ['en','hi','ta','te'] as const)for(const index of [0,1,2]){
  const s=startSession({sessionId:crypto.randomUUID(),locale,now:1800000000000,selectIndex:()=>index});
  const n=advanceSession(s,{sessionId:s.sessionId,expectedTurn:0,operationId:crypto.randomUUID(),reply:{origin:'typed',text:'Please explain.'}},null,s.updatedAt+1);
  const other=[0,1,2].filter(i=>i!==index).map(i=>startSession({sessionId:crypto.randomUUID(),locale,now:s.createdAt,selectIndex:()=>i})).map(x=>getScenario(x.scenarioId,locale).continuation);
  for(const text of [...examples[locale],...other,...approvedResponses(s.scenarioId,locale).map(t=>t+' '+examples[locale][0])])for(const source of ['hosted','fixture'] as const){
   const result=attachCaller(n,{locale,text,action:'continue'},source);assert.equal(result.source,'authored_fallback',text);assert.equal(result.session.lastCaller,n.lastCaller);
  }
  for(const text of approvedResponses(s.scenarioId,locale)){
   const result=attachCaller(n,{locale,text,action:'continue'},'hosted');assert.equal(result.source,'hosted');assert.equal(result.session.lastCaller,text);
   assert.equal(buildDebrief(endSession(result.session,n.updatedAt+1)).category,getScenario(s.scenarioId,locale).groundTruth);
  }
  assert.equal(attachCaller(n,{locale,text:approvedResponses(s.scenarioId,locale)[0],action:'continue',extra:'invented'},'hosted').source,'authored_fallback');
 }
});
