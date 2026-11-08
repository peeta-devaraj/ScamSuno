import { OperationSchema, type TurnOperation } from '../../domain/v2/contracts';
import { ConversationModelError,type ConversationGateway } from '../v2/caller';
import { InternalSessionSchema,type StoredSession } from './public-session';
import { advanceSession,attachCaller } from './controller';
import { requestEvaluation,requestCaller } from './caller';

/** Pure preparation: callers must own a durable V3 lease and inject a quota-admitted gateway. */
export async function prepareConversationTurn(state:StoredSession,operation:TurnOperation,gateway:ConversationGateway,
 options:{source:'hosted'|'fixture';now:number;signal?:AbortSignal;assertActive:()=>Promise<void>}){
 const s=InternalSessionSchema.parse(state),op=OperationSchema.parse(operation);
 // Validate clocks, session identity and lifecycle before any model request.
 advanceSession(s,op,null,options.now);
 const active=async()=>{if(options.signal?.aborted)throw new ConversationModelError('ABORTED');await options.assertActive();};
 await active();
 if(options.now>=s.expiresAt)return {session:advanceSession(s,op,null,options.now),status:'ready' as const,callerSource:'authored_fallback' as const};
 let candidate:unknown=null;
 if(op.reply.origin!=='button'){
  try{candidate=await requestEvaluation(s,op.reply,gateway,options.signal);}
  catch(error){if(options.signal?.aborted)throw new ConversationModelError('ABORTED');await active();return {session:s,status:'evaluation_unavailable' as const,callerSource:'authored_fallback' as const};}
 }
 await active();const next=advanceSession(s,op,candidate,options.now);
 if(next.ending)return {session:next,status:'ready' as const,callerSource:'authored_fallback' as const};
 try{
  await active();const raw=await requestCaller(s,op.reply,gateway,options.signal);await active();
  const attached=attachCaller(next,raw,options.source);
  return {session:attached.session,status:attached.source==='authored_fallback'?'caller_fallback' as const:'ready' as const,callerSource:attached.source};
 }catch(error){
  if(options.signal?.aborted)throw new ConversationModelError('ABORTED');await active();
  return {session:next,status:'caller_fallback' as const,callerSource:'authored_fallback' as const};
 }
}
