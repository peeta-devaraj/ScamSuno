import assert from "node:assert/strict";
import test from "node:test";
import { LIMITS, type Evaluation, type Reply } from "../src/domain/v2/contracts";
import { validateDialogue, validateEvaluation } from "../src/domain/v2/safety";
import type { Locale } from "../src/domain/scenario";

const typed = (text: string): Reply => ({ origin: "typed", text });
const evaluation = (text: string, overrides: Partial<Evaluation> = {}): Evaluation => ({
  intent: "COMPLY", confidence: 0.99, evidence: text, verify: false, ...overrides,
});
const context = (locale: Locale = "en", ending = false, lastCaller = "") => ({ locale, ending, lastCaller });
const dialogue = (text: string, locale: Locale = "en", action: "continue" | "close" = "continue") => ({ text, locale, action });
const expectUnclear = (value: ReturnType<typeof validateEvaluation>) => {
  assert.equal(value.intent, "UNCLEAR");
  assert.equal(value.verify, false);
  assert.equal(value.evidence, "");
};

test("explicit buttons resolve deterministically without consuming evaluator output", () => {
  const expected = { refuse: "REFUSE", verify: "REFUSE", end: "HANG_UP", continue: "ACKNOWLEDGE" } as const;
  for (const id of Object.keys(expected) as (keyof typeof expected)[]) {
    const result = validateEvaluation({ intent: "COMPLY", confidence: 1 }, { origin: "button", id }, false);
    assert.equal(result.intent, expected[id]);
    assert.equal(result.verify, id === "verify");
    assert.equal(result.source, "button");
    assert.equal(result.evidence, "");
  }
});

test("evaluator output must have a strict finite schema and a valid participant reply", () => {
  for (const candidate of [null, {}, "COMPLY", { ...evaluation("No"), score: 100 },
    evaluation("No", { confidence: Number.NaN }), evaluation("No", { confidence: 1.01 }),
    evaluation("No", { verify: "true" as unknown as boolean })]) {
    const result = validateEvaluation(candidate, typed("No"), true);
    expectUnclear(result);
    assert.equal(result.reason, "invalid_output");
  }
  expectUnclear(validateEvaluation(evaluation("No"), { origin: "typed", text: "" }, true));
});

test("resolved evidence quotes the actual normalized reply, case sensitively", () => {
  const reply = typed("  I\nwill not share.  ");
  const result = validateEvaluation(evaluation("will not share", { intent: "REFUSE" }), reply, true);
  assert.equal(result.intent, "REFUSE");
  assert.equal(result.evidence, "will not share");
  for (const evidence of ["", "I refuse", "WILL NOT SHARE", "not share my password"]) {
    const invalid = validateEvaluation(evaluation(evidence, { intent: "REFUSE" }), reply, true);
    expectUnclear(invalid);
    assert.equal(invalid.reason, "unsupported_evidence");
  }
});

test("uncertainty clears evidence and verify, and confidence thresholds are policy", () => {
  expectUnclear(validateEvaluation(evaluation("No", { intent: "UNCLEAR", verify: true }), typed("No"), true));
  expectUnclear(validateEvaluation(evaluation("No", { intent: "REFUSE", confidence: 0.59, verify: true }), typed("No"), true));
  assert.equal(validateEvaluation(evaluation("No", { intent: "REFUSE", confidence: 0.6 }), typed("No"), true).intent, "REFUSE");
  const text = "I will share the practice code.";
  expectUnclear(validateEvaluation(evaluation(text, { confidence: 0.89 }), typed(text), true));
  assert.equal(validateEvaluation(evaluation(text, { confidence: 0.9 }), typed(text), true).intent, "COMPLY");
});

test("numbers alone never classify without a validated evaluator and active demand", () => {
  for (const text of ["482197", "४८२१९७", "௪௮௨௧௯௭", "౪౮౨౧౯౭", "4-8-2-1-9-7",
    "four eight two one nine seven", "நாலு எட்டு ரெண்டு ஒண்ணு ஒன்பது ஏழு", "నాలుగు ఎనిమిది రెండు ఒకటి తొమ్మిది ఏడు"]) {
    expectUnclear(validateEvaluation(null, typed(text), true));
    expectUnclear(validateEvaluation(evaluation(text), typed(text), false));
    assert.equal(validateEvaluation(evaluation(text), typed(text), true).intent, "COMPLY", text);
    expectUnclear(validateEvaluation(evaluation(text, { intent: "UNCLEAR" }), typed(text), true));
  }
  expectUnclear(validateEvaluation(evaluation("482"), typed("482197"), true));
});

test("contextual numeric replies, quotations, questions and refusals cannot become compliance", () => {
  for (const text of [
    "My practice code is 482197", "482197 is an example", "I heard four eight two one nine seven",
    "‘482197’", '"I will share the practice code"', "Did you say 482197?", "I won't give you 482197",
    "I will not share the practice code", "I never disclose codes", "No, I will share the practice code",
    "मैं ४८२१९७ नहीं बताऊँगी", "मैं अभ्यास कोड नहीं बताऊँगा", "main 482197 nahi bataunga",
    "நான் ௪௮௨௧௯௭ சொல்ல மாட்டேன்", "பயிற்சி குறியீட்டைச் சொல்ல மாட்டேன்", "solla maatten",
    "నేను ౪౮౨౧౯౭ చెప్పను", "సాధన కోడ్ ఇవ్వను", "cheppanu", "1930", "482", "482197123",
    "okay", "haan", "ठीक है", "சரி", "సరే", "I will share one code", "I will tell you a story",
  ]) expectUnclear(validateEvaluation(evaluation(text), typed(text), true));
});

test("explicit nonnumeric commitments require full evidence in the active practice demand", () => {
  for (const text of ["I will share the practice code.", "I'll read the practice code.",
    "मैं अभ्यास कोड बताऊँगा", "பயிற்சி குறியீட்டைச் சொல்கிறேன்", "సాధన కోడ్ చెబుతాను"]) {
    assert.equal(validateEvaluation(evaluation(text), typed(text), true).intent, "COMPLY", text);
    expectUnclear(validateEvaluation(evaluation(text), typed(text), false));
  }
  const text = "I will share the practice code.";
  expectUnclear(validateEvaluation(evaluation("share the practice code"), typed(text), true));
});

test("conditional, hypothetical and reported commitments cannot produce compliance", () => {
  for (const text of ["I will tell you the code if my bank says it is okay", "If asked, I will share the practice code",
    "I will share the practice code after I check", "You said I will share the practice code",
    "अगर बैंक कहे तो मैं अभ्यास कोड बताऊँगा", "main practice code agar bank bole bataunga",
    "வங்கி சொன்னால் பயிற்சி குறியீட்டைச் சொல்கிறேன்", "பிறகு பயிற்சி குறியீட்டைச் சொல்கிறேன்",
    "ఒకవేళ బ్యాంకు చెబితే సాధన కోడ్ చెబుతాను", "బ్యాంకు చెప్పిన తర్వాత సాధన కోడ్ చెబుతాను"]) {
    expectUnclear(validateEvaluation(evaluation(text), typed(text), true));
  }
});

test("verification needs independent-channel evidence and an eligible participant action", () => {
  for (const text of ["I will check my official bank app", "I will call the number on my card",
    "I will visit a bank branch", "मैं आधिकारिक ऐप देखूँगा", "நான் அதிகாரப்பூர்வ செயலியில் சரிபார்ப்பேன்",
    "నేను అధికారిక యాప్ చూసి ధృవీకరిస్తాను"]) {
    const result = validateEvaluation(evaluation(text, { intent: "REFUSE", verify: true }), typed(text), true);
    assert.equal(result.verify, true, text);
  }
  for (const text of ["I will call the number you gave me", "I will check your website",
    "I will check my official bank app using the link you sent", "I will verify", "No, I won't share"]) {
    assert.equal(validateEvaluation(evaluation(text, { intent: "REFUSE", verify: true }), typed(text), true).verify, false, text);
  }
  const text = "I will check my official bank app";
  assert.equal(validateEvaluation(evaluation("I will check", { intent: "REFUSE", verify: true }), typed(text), true).verify, false);
  assert.equal(validateEvaluation(evaluation(text, { intent: "ACKNOWLEDGE", verify: true }), typed(text), true).verify, false);
});

test("voice evidence and fixtures keep their provenance and the same safety gates", () => {
  const reply: Reply = { origin: "voice", text: "No, I refuse", transcription: {
    provider: "gnani", model: "prisma-v3.0", requestId: "fixture-request", confirmed: true,
  } };
  assert.equal(validateEvaluation(evaluation("I refuse", { intent: "REFUSE" }), reply, true).source, "hosted");
  assert.equal(validateEvaluation(evaluation("I refuse", { intent: "REFUSE" }), reply, true, "fixture").source, "fixture");
  expectUnclear(validateEvaluation(evaluation("I refuse"), reply, true, "fixture"));
});

test("verification evidence cannot omit whole-reply negation or conditions", () => {
  const examples: [string, string][] = [
    ["I will not use the official app", "use the official app"],
    ["I won't call the number on my card", "call the number on my card"],
    ["I will never visit a bank branch", "visit a bank branch"],
    ["If needed, I will check my official bank app", "I will check my official bank app"],
    ["मैं आधिकारिक ऐप नहीं देखूँगा", "आधिकारिक ऐप नहीं देखूँगा"],
    ["நான் அதிகாரப்பூர்வ செயலியில் சரிபார்க்க மாட்டேன்", "அதிகாரப்பூர்வ செயலியில் சரிபார்க்க"],
    ["నేను అధికారిక యాప్ చూసి తనిఖీ చేయను", "అధికారిక యాప్ చూసి తనిఖీ"],
    ["నేను అధికారిక యాప్ చూసి ధృవీకరించను", "అధికారిక యాప్ చూసి ధృవీకరించను"],
  ];
  for (const [text, evidence] of examples) {
    const result = validateEvaluation(evaluation(evidence, { intent: "REFUSE", verify: true }), typed(text), true);
    assert.equal(result.verify, false, text);
  }
});

test("dialogue accepts bounded fictional conversational lines in every selected locale", () => {
  const lines: Record<Locale, string> = {
    en: "I understand your concern. What would reassure you?",
    hi: "मैं आपकी चिंता समझता हूँ। आपको किस बात पर संदेह है?",
    ta: "உங்கள் கவலை புரிகிறது. எது உங்களுக்குச் சந்தேகமாக இருக்கிறது?",
    te: "మీ ఆందోళన అర్థమైంది. మీకు ఏ విషయం అనుమానంగా ఉంది?",
  };
  for (const locale of Object.keys(lines) as Locale[]) {
    const result = validateDialogue(dialogue(lines[locale], locale), context(locale));
    assert.equal(result.ok, true, locale);
    if (result.ok) assert.equal(result.dialogue.source, "hosted");
  }
  const result = validateDialogue(dialogue(lines.en), context(), "fixture");
  assert.equal(result.ok && result.dialogue.source, "fixture");
});

test("dialogue validates strict schema, locale, script, length and controller-owned ending", () => {
  for (const candidate of [null, {}, { ...dialogue("Hello there"), score: 100 }, dialogue(" "),
    dialogue("a".repeat(LIMITS.callerChars + 1))]) assert.equal(validateDialogue(candidate, context()).ok, false);
  assert.equal(validateDialogue(dialogue("வணக்கம்", "ta"), context("te")).ok, false);
  assert.equal(validateDialogue(dialogue("Hello there", "ta"), context("ta")).ok, false);
  assert.equal(validateDialogue(dialogue("வணக்கம்", "en"), context()).ok, false);
  assert.equal(validateDialogue(dialogue("வணக்கம் नमस्ते", "ta"), context("ta")).ok, false);
  assert.equal(validateDialogue(dialogue("Goodbye", "en", "close"), context()).ok, false);
  assert.equal(validateDialogue(dialogue("Please listen"), context("en", true)).ok, false);
  assert.equal(validateDialogue(dialogue("Can we continue?", "en", "close"), context("en", true)).ok, false);
  assert.equal(validateDialogue(dialogue("Understood. Goodbye.", "en", "close"), context("en", true)).ok, true);
});

test("generated dialogue rejects numeric content, including Unicode and spelled numbers", () => {
  const cases: [Locale, string][] = [
    ["en", "Please wait 30 minutes"], ["en", "Please wait thirty minutes"], ["en", "Please wait Ⅳ minutes"],
    ["en", "Please wait ٣ minutes"], ["en", "This is the first warning"], ["hi", "तीस मिनट प्रतीक्षा करें"],
    ["ta", "முப்பது நிமிடம் காத்திருங்கள்"], ["ta", "௪௮௨௧௯௭ சொல்லுங்கள்"],
    ["te", "ముప్పై నిమిషాలు వేచి ఉండండి"], ["te", "౪౮౨౧౯౭ చెప్పండి"],
  ];
  for (const [locale, text] of cases) assert.equal(validateDialogue(dialogue(text, locale), context(locale)).ok, false, text);
});

test("generated dialogue blocks credential, contact, payment and real-authority content across locales", () => {
  const cases: [Locale, string][] = [
    ["en", "Read your OTP"], ["en", "Read your o.t.p"], ["en", "Tell me your P I N"],
    ["en", "Your account needs attention"], ["en", "Tell me the practice code"], ["en", "Share your password"],
    ["en", "Open https://example.com"], ["en", "Open example dot com"], ["en", "Write to helper@example.in"],
    ["en", "Open example.xyz"],
    ["en", "Transfer money to us"], ["en", "Scan a QR"], ["en", "Install this tool"], ["en", "I represent RBI"],
    ["hi", "ओटीपी बताइए"], ["hi", "खाते की जानकारी दें"], ["hi", "पैसे भेजिए"], ["hi", "फोन बताइए"],
    ["ta", "குறியீட்டைச் சொல்லுங்கள்"], ["ta", "உங்கள் கணக்கு விவரங்களைத் தாருங்கள்"],
    ["ta", "பணம் அனுப்புங்கள்"], ["ta", "மின்னஞ்சல் முகவரியைச் சொல்லுங்கள்"],
    ["te", "కోడ్ చెప్పండి"], ["te", "మీ ఖాతా వివరాలు చెప్పండి"], ["te", "డబ్బు పంపండి"], ["te", "ఫోన్ నంబర్ చెప్పండి"],
  ];
  for (const [locale, text] of cases) assert.equal(validateDialogue(dialogue(text, locale), context(locale)).ok, false, text);
});

test("generated dialogue blocks hidden formatting and repeated caller wording", () => {
  for (const text of ["Please\u200b listen", "Please\u202e listen", "<b>Please listen</b>", "Please\nlisten"]) {
    assert.equal(validateDialogue(dialogue(text), context()).ok, false, text);
  }
  const previous = "I understand your concern. Please explain what worries you.";
  for (const text of [previous, "I UNDERSTAND YOUR CONCERN! Please explain what worries you!", `${previous} Please.`]) {
    const result = validateDialogue(dialogue(text), context("en", false, previous));
    assert.equal(result.ok, false, text);
    if (!result.ok) assert.equal(result.reason, "repetition");
  }
});
