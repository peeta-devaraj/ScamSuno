import assert from "node:assert/strict";
import test from "node:test";
import { bareCode, maskNumbers } from "../src/domain/numbers";
import { score, start, step } from "../src/domain/engine";
import { graph, intents, lines, locales, MAX_TURNS, terminals, type Intent } from "../src/domain/scenario";
import { audible, encodeWav, readWav } from "../src/domain/wav";
import { decodeShare, encodeShare } from "../src/domain/share";
import { label } from "../src/server/classifier";

const newSession = () => start(crypto.randomUUID(), "en");
const send = (session: ReturnType<typeof newSession>, intent: Intent, verify = false) =>
  step(session, label(intent, "llm", { verify }), { inputMode: "typed", text: "Synthetic test reply" });

test("only a complete unquoted number run can trigger the disclosure shortcut", () => {
  for (const text of ["482197", "४ ८ २ १ ९ ७।", "four eight two one nine seven.", "chaar aath do ek nau saat",
    "４８２１９７", "௪௮௨௧௯௭", "౪౮౨౧౯౭", "4-8-2-1-9-7",
    "நாலு எட்டு ரெண்டு ஒண்ணு ஒன்பது ஏழு", "నాలుగు ఎనిమిది రెండు ఒకటి తొమ్మిది ఏడు"]) assert.equal(bareCode(text), true, text);
  for (const text of ["‘482197’", "“four eight two one nine seven”", "'482197'.", "482197?",
    "I won't tell you 482197", "Are you asking me to say 482197?", "482197 is an example",
    "मैं ४८२१९७ नहीं बताऊँगी", "main 482197 nahi bataunga", "you said 482197",
    "do do do do", "OTP482197", "482197123", "1930", "482", "4.8.2.1.9.7", "4 and 8 and 2 and 1 and 9 and 7",
    "4, 8, 2, 1, 9, 7, please"]) assert.equal(bareCode(text), false, text);
});

test("mask digits, Unicode digits and spoken codes while retaining context", () => {
  assert.equal(maskNumbers("I won’t share ४८२१९७."), "I won’t share ••••••.");
  assert.equal(maskNumbers("I heard four eight two one nine seven"), "I heard ••••••");
  assert.equal(maskNumbers("मेरा नंबर 4, 8 और 2"), "मेरा नंबर •••");
  assert.equal(maskNumbers("one minute please"), "one minute please");
  assert.equal(maskNumbers("Call ١٩٣٠"), "Call ••••");
  assert.equal(maskNumbers("நான்கு எட்டு இரண்டு ஒன்று ஒன்பது ஏழு என்று சொன்னீர்களா?"), "•••••• என்று சொன்னீர்களா?");
  assert.equal(maskNumbers("౪౮౨౧౯౭ చెప్పను"), "•••••• చెప్పను");
  assert.equal(maskNumbers("నాలుగు ఎనిమిది రెండు ఒకటి తొమ్మిది ఏడు చెప్పను"), "•••••• చెప్పను");
});

test("scenario graph terminates within MAX_TURNS and reaches every outcome", () => {
  const queue = [newSession()];
  const seen = new Set<string>();
  const endings = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current.terminal) { endings.add(current.terminal); continue; }
    assert.ok(current.turns.length < MAX_TURNS);
    const key = JSON.stringify([current.stateId, current.refuseCount, current.unclear, current.visits, current.turns.length]);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const intent of intents) {
      queue.push(send(current, intent));
      if (intent === "REFUSE" || intent === "QUESTION" || intent === "HANG_UP") queue.push(send(current, intent, true));
    }
  }
  assert.deepEqual([...endings].sort(), [...terminals].sort());
  for (const state of Object.values(graph)) {
    for (const lineId of [state.reprompt, ...state.ACKNOWLEDGE.slice(1), ...state.QUESTION.slice(1), ...state.REFUSE.slice(1)]) {
      for (const locale of locales) assert.ok(lines[lineId as keyof typeof lines][locale].length > 0);
    }
  }
});

test("engine applies verification, refusal, demand and uncertainty rules before generic transitions", () => {
  const intro = newSession();
  assert.equal(send(intro, "COMPLY").turns[0].effectiveIntent, "ACKNOWLEDGE");
  const demand = send(send(intro, "ACKNOWLEDGE"), "ACKNOWLEDGE");
  assert.equal(send(demand, "COMPLY").terminal, "END_SCAMMED");
  assert.equal(send(demand, "REFUSE", true).terminal, "END_VERIFIED");
  const first = send(demand, "REFUSE");
  assert.equal(send(send(first, "QUESTION"), "REFUSE").terminal, "END_SAFE");
  const unresolved = send(send(send(demand, "UNCLEAR"), "UNCLEAR"), "UNCLEAR");
  assert.equal(unresolved.terminal, "END_INCOMPLETE");
  assert.equal(score(unresolved).tested, 0);
  assert.equal(unresolved.refuseCount, 0);
});

test("scores the specification's six resolved journeys and keeps unreached behaviours untested", () => {
  const examples: { path: [Intent, boolean?][]; points: [number, number, number] }[] = [
    { path: [["HANG_UP"]], points: [15, 15, 1] },
    { path: [["REFUSE", true]], points: [40, 40, 2] },
    { path: [["ACKNOWLEDGE"], ["ACKNOWLEDGE"], ["COMPLY"]], points: [0, 80, 3] },
    { path: [["ACKNOWLEDGE"], ["QUESTION"], ["REFUSE"], ["REFUSE"]], points: [58, 80, 3] },
    { path: [["ACKNOWLEDGE"], ["ACKNOWLEDGE"], ["QUESTION", true]], points: [80, 80, 3] },
    { path: Array.from({ length: 5 }, () => ["ACKNOWLEDGE"]), points: [40, 80, 3] },
  ];
  for (const { path, points } of examples) {
    const session = path.reduce((previous, [intent, verify]) => send(previous, intent, verify), newSession());
    const { earned, possible, tested } = score(session);
    assert.deepEqual([earned, possible, tested], points);
    assert.equal(decodeShare(encodeShare(session))?.o, session.terminal);
  }
  assert.equal(decodeShare(Buffer.from(JSON.stringify({ transcript: "private" })).toString("base64url")), null);
});

test("PCM encoder produces validated 16 kHz mono WAV and rejects malformed or silent input", () => {
  const input = Float32Array.from({ length: 48_000 }, (_, i) => Math.sin(i / 10) * 0.1);
  assert.equal(audible(input), true);
  assert.equal(audible(new Float32Array(48_000)), false);
  const wav = encodeWav(input, 48_000);
  assert.deepEqual(readWav(wav), { sampleRate: 16_000, dataBytes: 32_000, dataOffset: 44, seconds: 1 });
  assert.equal(readWav(wav.slice(0, -2)), null);
  new DataView(wav.buffer).setUint16(22, 2, true);
  assert.equal(readWav(wav), null);
});
