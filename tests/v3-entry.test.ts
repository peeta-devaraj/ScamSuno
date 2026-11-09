import test from 'node:test';
import assert from 'node:assert/strict';
import Page from '../app/page';
import { approvedPublicOrigin, scriptedPracticeOrigin, trustOrTrapMetadata } from '../src/server/brand';

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

test('social metadata uses a verified production origin only, with a distinct scripted fallback', () => {
  const canonical = 'https://scamsuno.vercel.app';
  const preview = { VERCEL_ENV: 'preview', SCAMSUNO_PUBLIC_ORIGIN: canonical };
  assert.equal(trustOrTrapMetadata(preview).alternates, undefined);
  assert.equal(trustOrTrapMetadata(preview).openGraph?.images, undefined);
  assert.equal(approvedPublicOrigin({ VERCEL_ENV: 'production', SCAMSUNO_PUBLIC_ORIGIN: 'https://scamsuno-unapproved.vercel.app' }), undefined);
  const publicEnv = { ...preview, VERCEL_ENV: 'production', SCAMSUNO_SCRIPTED_PRACTICE_ORIGIN: 'https://scripted.example' };
  const metadata = trustOrTrapMetadata(publicEnv);
  assert.equal(metadata.alternates?.canonical, canonical);
  assert.equal(metadata.openGraph?.url, canonical);
  assert.deepEqual(metadata.twitter?.images, [{
    url: canonical + '/brand/scamsuno-social.png',
    alt: 'ScamSuno waveform on plum. Can you trust this call? Trust or Trap educational simulation.',
  }]);
  assert.equal(scriptedPracticeOrigin(preview), 'https://scamsuno-classic.vercel.app');
  assert.equal(scriptedPracticeOrigin(publicEnv), 'https://scripted.example');
  assert.equal(scriptedPracticeOrigin({ ...publicEnv, SCAMSUNO_SCRIPTED_PRACTICE_ORIGIN: canonical }), 'https://scamsuno-classic.vercel.app');
});
