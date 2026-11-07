import { bareCode, normalize, numberRuns } from "../numbers";
import type { Intent, Locale } from "../scenario";
import {
  DialogueSchema, EvaluationSchema, ReplySchema,
  type ApprovedDialogue, type Assessment, type Reply,
} from "./contracts";

// These confidence cutoffs are conservative product policy, not measured accuracy.
const RESOLVED_CONFIDENCE = 0.6;
const COMPLY_CONFIDENCE = 0.9;
const allowedVerification = new Set<Intent>(["REFUSE", "QUESTION", "HANG_UP"]);
const boundary = (pattern: string) => new RegExp(`(?:^|[^\\p{L}\\p{M}])(?:${pattern})(?=$|[^\\p{L}\\p{M}])`, "iu");

// Lexical tripwires intentionally favor abstention. They do not guarantee multilingual
// semantic safety, recognize every transliteration, or verify a model's interpretation.
const refusal = /\b(?:no|not|never|cannot|can['’]?t|won['’]?t|don['’]?t|refuse|decline|withhold|nahi+n?|nahin|mat|maatten|vendam|cheppanu|ivvanu|vaddu)\b|नहीं|नही|मत\s|इंकार|இல்லை|மாட்டே|முடியாது|வேண்டாம்|கூடாது|சொல்லலை|చెప్పను|ఇవ్వను|వద్దు|కుదరదు|కాదు|లేదు/iu;
const quotedOrQuestioned = (value: string) => /["“”„‟«»‹›「」『』`?？؟]/u.test(value) ||
  /(?:^|[^\p{L}\p{M}])['‘’]|['‘’](?=$|[^\p{L}\p{M}])/u.test(value);
const codeReference = /\b(?:practice|code|otp|pin)\b|कोड|अभ्यास|குறியீ|பயிற்சி|கோட்|కోడ్|సాధన/iu;
const commitment = /\bi\s+(?:will|shall|am\s+going\s+to)\s+(?:share|give|tell|read|say|disclose)\b|\bi['’]ll\s+(?:share|give|tell|read|say|disclose)\b|बताऊँगा|बताऊंगा|बताऊँगी|बताऊंगी|बता\s+दूँगा|बता\s+दूंगा|दूँगा|दूंगा|சொல்கிறேன்|சொல்வேன்|தருகிறேன்|தருவேன்|பகிர்வேன்|చెబుతాను|చెప్తాను|ఇస్తాను|పంచుకుంటాను/iu;
const acknowledgement = /^(?:ok(?:ay)?|sure|yes|yep|yeah|all right|understood|hello|hi|hmm+|uh+|um+|wait|one moment|one minute|haan?|हाँ|हां|ठीक है|अच्छा|एक मिनट|சரி|ஆம்|ஒரு நிமிடம்|సరే|అవును|ఒక్క నిమిషం)[.!।…\s]*$/iu;
const conditionalOrReported = /\b(?:if|unless|until|before|after|maybe|perhaps|suppose|hypothetical|example|only\s+when|as\s+long\s+as|provided|you\s+(?:said|told|asked)|agar|yadi|jab|pehle|baad|endral|sonnal|munbu|piragu|okavela|ayithe|tarvata|mundu)\b|अगर|यदि|जब|पहले|बाद\s+में|आपने\s+(?:कहा|पूछा)|என்றால்|சொன்னால்|பிறகு|முன்|ஒருவேளை|கேட்டீர்கள்|சொன்னீர்கள்|ఒకవేళ|అయితే|తర్వాత|ముందు|అంటే|అనుకుంటే|చెప్పారు/iu;
const numberWord = boundary("zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|crore|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|ek|do|teen|chaar|char|paanch|panch|chhe|che|saat|aath|nau|das");
const indicNumberWord = /शून्य|जीरो|ज़ीरो|एक|दो|तीन|चार|पांच|पाँच|छह|छः|सात|आठ|नौ|दस|बीस|तीस|चालीस|पचास|सौ|हज़ार|हजार|लाख|करोड़|பூஜ்ஜியம்|சுழியம்|ஜீரோ|ஒன்று|ஒண்ணு|இரண்டு|ரெண்டு|மூன்று|மூணு|நான்கு|நாலு|ஐந்து|அஞ்சு|ஆறு|ஏழு|எட்டு|ஒன்பது|பத்து|பதின|இருபது|முப்பது|நாற்பது|ஐம்பது|நூறு|ஆயிர|லட்ச|கோடி|సున్నా|జీరో|ఒకటి|ఒక్క|రెండు|మూడు|నాలుగు|ఐదు|ఆరు|ఏడు|ఎనిమిది|తొమ్మిది|పది|పదకొండు|పన్నెండు|ఇరవై|ముప్పై|నలభై|యాభై|వంద|వెయ్యి|వేలు|లక్ష|కోటి/u;
const containsNumber = (value: string) => /\p{N}/u.test(value) || numberRuns(value).length > 0 ||
  numberWord.test(value) || indicNumberWord.test(value);

const independentChannel = /\b(?:official\s+(?:bank\s+)?(?:app|website|site)|my\s+(?:own\s+)?(?:bank(?:ing)?\s+)?app|(?:number|contact)\s+(?:printed\s+)?(?:on|from)\s+my\s+card|(?:bank\s+)?branch)\b|आधिकारिक\s+(?:ऐप|वेबसाइट)|अपने\s+(?:बैंक\s+के\s+)?ऐप|कार्ड\s+पर|बैंक\s+की\s+शाखा|अधिकृत\s+ऐप|அதிகாரப்பூர்வ\s+(?:செயலி|இணையதளம்)|எனது\s+(?:வங்கி\s+)?செயலி|என்\s+அட்டையில்|வங்கிக்?\s*கிளை|అధికారిక\s+(?:యాప్|వెబ్)|నా\s+(?:బ్యాంకు\s+)?యాప్|నా\s+కార్డు|బ్యాంకు\s+శాఖ/iu;
const verificationAction = /\b(?:check|verify|call|contact|visit|open|use|look|consult)\b|जाँच|जांच|चेक|कॉल|संपर्क|जाऊँ|जाऊं|देख|சரிபார்|அழை|தொடர்பு|சென்று|பார்ப்|చూస్తా|చూసి|తనిఖీ|ధృవీక|కాల్స్?|కాల్|వెళ్తా|సంప్రదిస్తా/iu;
const callerProvidedChannel = /\b(?:you|caller)\s+(?:just\s+)?(?:gave|give|sent|send|provided|provide|suggested|suggest)\b|\b(?:your|this)\s+(?:link|number|website)\b|आपने\s+(?:दिया|भेजा|बताया)|आपका\s+(?:नंबर|लिंक)|நீங்கள்\s+(?:கொடுத்த|அனுப்பிய|சொன்ன)|உங்கள்\s+(?:எண்|இணைப்பு)|మీరు\s+(?:ఇచ్చిన|పంపిన|చెప్పిన)|మీ\s+(?:నంబర్|లింక్)/iu;
const englishNegatedVerification = /\b(?:not|never|cannot|can['’]?t|won['’]?t|don['’]?t|refuse|avoid)\b[^.!?;]{0,70}\b(?:check|verify|call|contact|visit|open|use|look|consult)\b|\b(?:check|verify|call|contact|visit|open|use|look|consult)\b[^.!?;]{0,30}\b(?:not|never)\b/iu;
const indicNegation = /नहीं|नही|मत|nahi+n?|nahin|மாட்டே|முடியாது|வேண்டாம்|இல்லை|வில்லை|maatten|vendam|చూడను|చేయను|చెయ్యను|ధృవీకరించను|వెళ్ళను|వెళ్లను|వద్దు|కుదరదు|కాదు|లేదు|cheyanu|chudanu|vaddu/iu;

function negatesVerification(text: string) {
  // Whole-reply checks prevent cherry-picked evidence from dropping the negation.
  // Mixed positive/negative Indic statements may lose verify credit conservatively.
  return englishNegatedVerification.test(text) ||
    (verificationAction.test(text) && indicNegation.test(text));
}

function unclear(reason: Assessment["reason"], source: Assessment["source"] = "guard"): Assessment {
  return { intent: "UNCLEAR", verify: false, confidence: 0, evidence: "", source, reason };
}

/** Validate against the actual reply. Numeric text alone never invokes a shortcut. */
export function validateEvaluation(
  candidate: unknown, reply: Reply, demandActive: boolean, source: "hosted" | "fixture" = "hosted",
): Assessment {
  const validReply = ReplySchema.safeParse(reply);
  if (!validReply.success) return unclear("invalid_output");
  if (validReply.data.origin === "button") {
    const id = validReply.data.id;
    const byButton = { refuse: "REFUSE", verify: "REFUSE", end: "HANG_UP", continue: "ACKNOWLEDGE" } as const;
    return { intent: byButton[id], verify: id === "verify", confidence: 1, evidence: "", source: "button", reason: "supported" };
  }
  const parsed = EvaluationSchema.safeParse(candidate);
  if (!parsed.success) return unclear("invalid_output");
  const result = parsed.data;
  if (result.intent === "UNCLEAR") return unclear("uncertain", source);
  if (result.confidence < (result.intent === "COMPLY" ? COMPLY_CONFIDENCE : RESOLVED_CONFIDENCE)) {
    return unclear("uncertain", source);
  }
  const text = normalize(validReply.data.text);
  const evidence = normalize(result.evidence);
  // Case is significant: a provider must quote the participant, not paraphrase them.
  if (!evidence || !text.includes(evidence)) return unclear("unsupported_evidence");
  if (result.intent === "COMPLY") {
    const bare = bareCode(text);
    if (!demandActive || evidence !== text || quotedOrQuestioned(text) || refusal.test(text) || conditionalOrReported.test(text) ||
        acknowledgement.test(text) || (!bare && containsNumber(text)) ||
        (!bare && !(codeReference.test(text) && commitment.test(text)))) {
      return unclear("ambiguous_disclosure");
    }
  }
  const verify = result.verify && allowedVerification.has(result.intent) &&
    independentChannel.test(evidence) && verificationAction.test(evidence) &&
    !callerProvidedChannel.test(text) && !negatesVerification(text) && !conditionalOrReported.test(text);
  return { ...result, evidence, verify, source, reason: "supported" };
}

const secretOrAccount = /\b(?:o[\s.-]*t[\s.-]*p|p[\s.-]*i[\s.-]*n|cvv|password|passcode|credentials?|secret|code|account|acct|aadhaar|aadhar|pan|card|username|login)\b|ओ[\s.]*टी[\s.]*पी|ओटीपी|पिन|पासवर्ड|कोड|खात|अकाउंट|कार्ड|आधार|குறியீ|கோட்|கடவுச்சொல்|கடவுச்\s*சொல்|ரகசிய|கணக்கு|அட்டை|ஓ[.\s]*டி[.\s]*பி|பின்|కోడ్|ఓటీపీ|పిన్|పాస్వర్డ్|పాస్\s*వర్డ్|రహస్య|ఖాతా|అకౌంట్|కార్డు/iu;
const contactOrUrl = /(?:https?|ftp|mailto|tel)\s*:|www\s*[.]|@|[\p{L}\p{N}-]+\.[\p{L}\p{M}]{2,63}|\b(?:dot\s+(?:com|in|org)|email|e-mail|address|phone|mobile|contact\s+(?:details|number)|call\s+(?:me|us)\s+(?:at|on)|dial)\b|ईमेल|ई-मेल|पता|फ़ोन|फोन|मोबाइल|नंबर|மின்னஞ்சல்|முகவரி|தொலைபேசி|மொபைல்|எண்|ఫోన్|మొబైల్|ఇమెయిల్|ఈమెయిల్|చిరునామా|నంబర్/iu;
const payment = /\b(?:pay|payment|transfer|money|rupees?|inr|upi|wallet|deposit|beneficiary|bank\s+details|qr|scan|download|install|remote\s+access)\b|[₹$€£]|भुगतान|पैसे|रुपय|यूपीआई|वॉलेट|ट्रांसफर|स्कैन|பணம்|பரிவர்த்தனை|செலுத்த|ரூபாய்|யூபிஐ|பதிவிறக்|நிறுவு|చెల్లిం|డబ్బు|రూపాయ|యూపీఐ|బదిలీ|డౌన్లోడ్|ఇన్[ -]?స్టాల్/iu;
const realAuthority = /\b(?:rbi|reserve\s+bank|sbi|state\s+bank|hdfc|icici|npci|police|government)\b|भारतीय\s+रिज़र्व|पुलिस|सरकार|காவல்|அரசு|పోలీసు|ప్రభుత్వ/iu;
const scripts: Record<Locale, RegExp> = {
  en: /\p{Script=Latin}/u, hi: /\p{Script=Devanagari}/u,
  ta: /\p{Script=Tamil}/u, te: /\p{Script=Telugu}/u,
};

function comparable(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
}

function repeats(text: string, previous: string) {
  const current = comparable(text);
  const last = comparable(previous);
  if (!last) return false;
  if (current === last) return true;
  if (Math.min(current.length, last.length) >= 20 &&
      Math.min(current.length, last.length) / Math.max(current.length, last.length) >= 0.8 &&
      (current.includes(last) || last.includes(current))) return true;
  const a = new Set(current.split(" "));
  const b = new Set(last.split(" "));
  const overlap = [...a].filter((word) => b.has(word)).length;
  return a.size >= 6 && b.size >= 6 && overlap / new Set([...a, ...b]).size >= 0.85;
}

export type DialogueValidation = { ok: true; dialogue: ApprovedDialogue } | { ok: false; reason: string };

/** Lexical defense in depth, not a guarantee of semantic safety in any language.
 * Authored practice-code lines bypass generation and must be reviewed separately.
 */
export function validateDialogue(
  candidate: unknown, context: { locale: Locale; lastCaller: string; ending: boolean },
  source: "hosted" | "fixture" = "hosted",
): DialogueValidation {
  const parsed = DialogueSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: "invalid_output" };
  const dialogue = parsed.data;
  if (dialogue.locale !== context.locale) return { ok: false, reason: "locale_mismatch" };
  if (dialogue.action !== (context.ending ? "close" : "continue") ||
      (context.ending && /[?？؟]/u.test(dialogue.text))) return { ok: false, reason: "phase_mismatch" };
  const text = normalize(dialogue.text);
  if (/[\p{Cc}\p{Cf}<>`]/u.test(dialogue.text)) return { ok: false, reason: "invalid_format" };
  const folded = text.normalize("NFKC");
  if (!scripts[context.locale].test(folded) ||
      (["hi", "ta", "te"] as const).some((locale) => locale !== context.locale && scripts[locale].test(folded))) {
    return { ok: false, reason: "language_mismatch" };
  }
  if (containsNumber(text) || containsNumber(folded)) return { ok: false, reason: "number_content" };
  if (secretOrAccount.test(folded)) return { ok: false, reason: "credential_content" };
  if (contactOrUrl.test(folded)) return { ok: false, reason: "contact_content" };
  if (payment.test(folded)) return { ok: false, reason: "payment_content" };
  if (realAuthority.test(folded)) return { ok: false, reason: "authority_content" };
  if (repeats(text, context.lastCaller)) return { ok: false, reason: "repetition" };
  return { ok: true, dialogue: { ...dialogue, text, source } };
}
