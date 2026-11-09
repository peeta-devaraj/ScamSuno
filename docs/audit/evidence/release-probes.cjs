// Offline release probes. All participant text and provider configuration are synthetic.
const {createClient} = require('@libsql/client');
const {createConversationHandler} = require('../../../src/server/v3/conversation-http.ts');
const {buildCallerMessages, buildEvaluatorMessages} = require('../../../src/server/v3/caller.ts');
const {initializeSessions, createStoredSession} = require('../../../src/server/v3/sessions.ts');
const {initializeLedger} = require('../../../src/server/v2/ledger.ts');
const {POST: v2Start} = require('../../../app/api/v2/conversation/route.ts');
const {v2Database} = require('../../../src/server/v2/runtime.ts');

function startRequest(path) {
  return new Request('https://fixture.invalid' + path, {
    method: 'POST',
    headers: {origin: 'https://fixture.invalid', 'content-type': 'application/json'},
    body: JSON.stringify({action: 'start', locale: 'en'}),
  });
}

async function main() {
  const db = createClient({url: 'file::memory:'});
  try {
    await initializeLedger(db);
    await initializeSessions(db);
    const handler = createConversationHandler({
      mode: () => 'live',
      database: async () => db,
      gateway: () => { throw new Error('Provider must not be reached by this probe'); },
    });
    const statuses = await Promise.all(Array.from({length: 12}, async () =>
      (await handler(startRequest('/api/v3/conversation'))).status));
    const {rows} = await db.execute('SELECT COUNT(*) AS count FROM v3_sessions');
    console.log(JSON.stringify({probe: 'closed_ledger_start_burst', requests: statuses.length,
      successful: statuses.filter(status => status === 200).length, persisted: Number(rows[0].count)}));

    const {session} = await createStoredSession(db, 'en');
    const reply = {origin: 'typed', text: '482197'};
    console.log(JSON.stringify({probe: 'bare_number_model_payload', caller: JSON.stringify(buildCallerMessages(session, reply)).includes(reply.text),
      evaluator: JSON.stringify(buildEvaluatorMessages(session, reply)).includes(reply.text)}));

    process.env.V3_TRUST_OR_TRAP_ENABLED = 'true';
    process.env.V2_LIVE_ENABLED = 'true';
    process.env.LLM_API_KEY = 'synthetic-unused';
    process.env.V2_DATABASE_URL = 'file::memory:';
    delete process.env.VERCEL;
    const response = await v2Start(startRequest('/api/v2/conversation'));
    console.log(JSON.stringify({probe: 'v2_start_on_v3_deployment', status: response.status}));
    if (response.ok) (await v2Database()).close();
  } finally {
    db.close();
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
