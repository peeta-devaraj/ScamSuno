import test from 'node:test';
import assert from 'node:assert/strict';
import Page from '../app/page';

test('explicit V3 deployments redirect root to the V3 entry and preserve validated locales', async t => {
  const previous=process.env.V3_TRUST_OR_TRAP_ENABLED;
  t.after(()=>{if(previous===undefined)delete process.env.V3_TRUST_OR_TRAP_ENABLED;else process.env.V3_TRUST_OR_TRAP_ENABLED=previous;});
  process.env.V3_TRUST_OR_TRAP_ENABLED='true';
  for(const [language,expected] of [['ta','ta'],['te','te'],['hi','hi'],['en','en'],['invalid','en'],[undefined,'en']]){
    await assert.rejects(()=>Page({searchParams:Promise.resolve({l:language})}),error=>{
      assert.equal((error as Error & {digest:string}).digest,`NEXT_REDIRECT;replace;/v3?l=${expected};307;`);
      return true;
    });
  }
});

test('flag-off deployments retain the V1 root component', async t => {
  const previous=process.env.V3_TRUST_OR_TRAP_ENABLED;
  t.after(()=>{if(previous===undefined)delete process.env.V3_TRUST_OR_TRAP_ENABLED;else process.env.V3_TRUST_OR_TRAP_ENABLED=previous;});
  process.env.V3_TRUST_OR_TRAP_ENABLED='false';
  const result=await Page({searchParams:Promise.resolve({l:'te'})});
  assert.equal(result.props.initial,'te');
  assert.equal(result.props.trustOrTrap,false);
});
