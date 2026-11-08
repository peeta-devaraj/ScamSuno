import test from 'node:test';
import assert from 'node:assert/strict';
import { trustOrTrapEnabled, liveTrustOrTrapMode } from '../src/server/v3/config';

test('V3 defaults off and disabling it leaves V2 provider configuration unchanged', t => {
  const keys=['V3_TRUST_OR_TRAP_ENABLED','V2_LIVE_ENABLED','LLM_API_KEY','LLM_BASE_URL','LLM_MODEL'];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of keys) if(before[k]===undefined) delete process.env[k]; else process.env[k]=before[k];});
  process.env.V2_LIVE_ENABLED='true'; process.env.LLM_API_KEY='explicit-fixture-key';
  process.env.LLM_BASE_URL='https://api.groq.com/openai/v1'; process.env.LLM_MODEL='openai/gpt-oss-20b';
  for(const value of [undefined,'false','TRUE','1','true ']) {
    if(value===undefined)delete process.env.V3_TRUST_OR_TRAP_ENABLED;else process.env.V3_TRUST_OR_TRAP_ENABLED=value;
    assert.equal(trustOrTrapEnabled(),false);assert.equal(liveTrustOrTrapMode(),null);
  }
  process.env.V3_TRUST_OR_TRAP_ENABLED='true';assert.equal(liveTrustOrTrapMode(),'live');
  process.env.V2_LIVE_ENABLED='false'; assert.equal(liveTrustOrTrapMode(),null);
  assert.equal(trustOrTrapEnabled(),true);
  process.env.V2_LIVE_ENABLED='true';delete process.env.LLM_API_KEY;assert.equal(liveTrustOrTrapMode(),null);
});
