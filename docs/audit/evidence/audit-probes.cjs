// Offline audit observations, synthetic inputs only. No application modifications.
const {startSession, advanceSession, attachCaller, endSession, buildDebrief}=require('../../../src/server/v3/controller.ts');
const {buildCallerMessages}=require('../../../src/server/v3/caller.ts');
const {prepareConversationTurn}=require('../../../src/server/v3/conversation.ts');
async function main(){ const now=1800000000000;
const state=startSession({sessionId:crypto.randomUUID(),locale:'en',now,selectIndex:()=>0});
const operation={sessionId:state.sessionId,operationId:crypto.randomUUID(),expectedTurn:0,reply:{origin:'typed',text:'What is the service update?'}};
const next=advanceSession(state,operation,null,now+1);
const contradiction=attachCaller(next,{locale:'en',action:'continue',text:'There is no service update in the app.'},'hosted');
console.log(JSON.stringify({probe:'scenario_contradiction',assigned:'routine_update',acceptedSource:contradiction.source,caption:contradiction.session.lastCaller}));
const leak=buildCallerMessages(state,{origin:'typed',text:'The password I use is synthetic-mango-test-only.'});
console.log(JSON.stringify({probe:'credential_paraphrase',syntheticValueSentToModel:JSON.stringify(leak).includes('synthetic-mango-test-only')}));
for(let index=0;index<3;index++){
 const s=startSession({sessionId:crypto.randomUUID(),locale:'en',now,selectIndex:()=>index});
 console.log(JSON.stringify({probe:'immediate_hangup',category:index,decisions:buildDebrief(endSession(s,now+1)).decisions.map(d=>({id:d.id,status:d.status}))}));
}
const purposes=[];
const {validateDecisionEvidence}=require('../../../src/server/v3/evaluation.ts');
for(const text of ['I will use the link you sent.', 'నేను మీరు ఇచ్చిన లింక్‌ను ఉపయోగిస్తాను.']){
 console.log(JSON.stringify({probe:'channel_trust_language',text,observation:validateDecisionEvidence({origin:'typed',text},{kind:'caller_channel_trust',confidence:0.99,evidence:text},1)}));
}
const result=await prepareConversationTurn(state,operation,{execute:async(req)=>{purposes.push(req.purpose);throw new Error('synthetic provider failure');}},
 {source:'hosted',now:now+1,assertActive:async()=>{}});
console.log(JSON.stringify({probe:'evaluator_outage',purposes,status:result.status,turn:result.session.turn}));

}
main().catch(error=>{console.error(error);process.exitCode=1;});


