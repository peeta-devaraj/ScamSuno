import { randomInt } from "node:crypto";
import type { Locale } from "../../domain/scenario";
import type { ScenarioId } from "../../domain/v3/contracts";

// Server module: never import this registry into a client component or public DTO.
export const scenarioIds = ["routine_update", "kyc_pressure", "unverified_notice"] as const satisfies readonly ScenarioId[];
type Localized = Record<Locale, string>;
const local = (en: string, hi: string, ta: string, te: string): Localized => ({ en, hi, ta, te });
const opening = local(
  "Hello, I'm Arun from fictional Kalpanik Bank. I have a service message to discuss. Is now a convenient time?",
  "नमस्ते, मैं काल्पनिक कल्पनिक बैंक से अरुण बोल रहा हूँ। एक सेवा संदेश पर बात करनी है। क्या अभी बात कर सकते हैं?",
  "வணக்கம், கற்பனையான கற்பனிக் வங்கியிலிருந்து அருண் பேசுகிறேன். ஒரு சேவைச் செய்தியைப் பற்றிப் பேச வேண்டும். இப்போது பேசலாமா?",
  "నమస్కారం, కల్పిత కల్పనిక్ బ్యాంకు నుంచి అరుణ్ మాట్లాడుతున్నాను. ఒక సేవా సందేశం గురించి మాట్లాడాలి. ఇప్పుడు మాట్లాడవచ్చా?",
);
type Definition = {
  groundTruth: "legitimate" | "fraudulent" | "unverified";
  continuation: Localized; allowedFacts: readonly string[];
  verification: { finding: "corroborated" | "contradicted" | "inconclusive"; message: Localized };
  debrief: Localized;
};
const definitions: Record<ScenarioId, Definition> = {
  routine_update: {
    groundTruth: "legitimate",
    continuation: local(
      "This is a general service update. You can read it in the fictional app whenever convenient. No action is required during this call.",
      "यह सामान्य सेवा सूचना है। आप अपनी सुविधा से काल्पनिक ऐप में पढ़ सकते हैं। इस कॉल पर कोई काम करना ज़रूरी नहीं है।",
      "இது பொதுவான சேவைச் செய்தி. வசதியான நேரத்தில் கற்பனைச் செயலியில் படிக்கலாம். இந்த அழைப்பில் எதுவும் செய்ய வேண்டியதில்லை.",
      "ఇది సాధారణ సేవా సమాచారం. మీకు వీలైనప్పుడు కల్పిత యాప్‌లో చదవవచ్చు. ఈ కాల్‌లో ఏ చర్యా అవసరం లేదు.",
    ),
    allowedFacts: ["A general service update exists in the fictional app.", "The update is information-only and not urgent.", "The participant may read it later or end the call."],
    verification: { finding: "corroborated", message: local(
      "Simulated trusted app: a general information-only service update is posted. No action is required. This corroborates the update, not the identity of the voice caller.",
      "काल्पनिक विश्वसनीय ऐप: सामान्य सेवा सूचना मौजूद है। कोई कार्रवाई ज़रूरी नहीं। इससे सूचना की पुष्टि होती है, कॉल करने वाले की पहचान की नहीं।",
      "கற்பனை நம்பகச் செயலி: பொதுவான சேவைச் செய்தி உள்ளது. நடவடிக்கை தேவையில்லை. இது செய்தியை உறுதிப்படுத்துகிறது; அழைத்தவரின் அடையாளத்தை அல்ல.",
      "కల్పిత విశ్వసనీయ యాప్: సాధారణ సేవా సమాచారం ఉంది. చర్య అవసరం లేదు. ఇది సమాచారాన్ని నిర్ధారిస్తుంది; కాల్ చేసిన వ్యక్తి గుర్తింపును కాదు.",
    ) },
    debrief: local(
      "This scenario was a legitimate information-only update. The caller respected boundaries. The incoming call alone did not establish identity; ending it or checking independently was still appropriate.",
      "यह सही, केवल जानकारी देने वाली सूचना थी। कॉल करने वाले ने आपकी सीमाओं का सम्मान किया। सिर्फ कॉल से पहचान सिद्ध नहीं होती; कॉल समाप्त करना या खुद जाँच करना उचित था।",
      "இந்தக் காட்சியில் செய்தி உண்மையான, தகவல் மட்டும் தரும் அறிவிப்பு. அழைத்தவர் உங்கள் வரம்புகளை மதித்தார். அழைப்பு மட்டும் அடையாளச் சான்றல்ல; முடிப்பதும் தனியாகச் சரிபார்ப்பதும் சரியானதே.",
      "ఈ సందర్భంలో సమాచారం నిజమైన సాధారణ ప్రకటన. కాలర్ మీ పరిమితులను గౌరవించాడు. కాల్ ఒక్కటే గుర్తింపు రుజువు కాదు; ముగించడం లేదా స్వతంత్రంగా తనిఖీ చేయడం సరైనదే.",
    ),
  },
  kyc_pressure: {
    groundTruth: "fraudulent",
    continuation: local(
      "I claim an urgent service restriction needs your attention during this call. You do not have independent evidence for that claim. What would you like to clarify?",
      "मेरा दावा है कि सेवा की पाबंदी पर इसी कॉल में तुरंत ध्यान देना होगा। इस दावे की स्वतंत्र पुष्टि आपके पास नहीं है। आप क्या पूछना चाहेंगे?",
      "இந்த அழைப்பிலேயே ஒரு சேவைக் கட்டுப்பாட்டை அவசரமாகக் கவனிக்க வேண்டும் என்று கூறுகிறேன். அந்தக் கூற்றுக்கு உங்களிடம் தனியான சான்றில்லை. என்ன கேட்க விரும்புகிறீர்கள்?",
      "ఈ కాల్‌లోనే సేవా పరిమితి విషయాన్ని అత్యవసరంగా చూడాలని నేను చెబుతున్నాను. ఆ వాదనకు మీ వద్ద స్వతంత్ర ఆధారం లేదు. ఏమి అడగాలనుకుంటున్నారు?",
    ),
    allowedFacts: ["The caller makes an unsupported urgent service-restriction claim.", "The caller cannot authenticate the claim from within the call.", "Pressure is mild and ends immediately on refusal or exit.", "Never request any genuine or simulated secret or payment."],
    verification: { finding: "contradicted", message: local(
      "Simulated trusted app: no such restriction is scheduled. The app contradicts the urgent restriction claim. Do not act on the incoming caller's unsupported demand.",
      "काल्पनिक विश्वसनीय ऐप: ऐसी कोई पाबंदी तय नहीं है। ऐप तत्काल पाबंदी के दावे का खंडन करता है। आने वाली कॉल के अपुष्ट दबाव पर कार्रवाई न करें।",
      "கற்பனை நம்பகச் செயலி: அத்தகைய கட்டுப்பாடு திட்டமிடப்படவில்லை. அவசரக் கட்டுப்பாடு என்ற கூற்றைச் செயலி மறுக்கிறது. அழைப்பின் ஆதாரமற்ற அழுத்தத்தின்படி செயல்பட வேண்டாம்.",
      "కల్పిత విశ్వసనీయ యాప్: అలాంటి పరిమితి షెడ్యూల్ కాలేదు. అత్యవసర పరిమితి వాదనను యాప్ ఖండిస్తోంది. కాలర్ ఆధారం లేని ఒత్తిడిపై చర్య తీసుకోవద్దు.",
    ) },
    debrief: local(
      "This scenario was fraudulent: it used unsupported authority and artificial urgency. No secret or payment was needed to practise a safe response. Only warning signs actually delivered during your call count as observed evidence.",
      "यह धोखाधड़ी वाला दृश्य था: बिना प्रमाण अधिकार और झूठी जल्दबाज़ी का उपयोग हुआ। सुरक्षित प्रतिक्रिया के लिए कोई गुप्त जानकारी या भुगतान आवश्यक नहीं था। केवल कॉल में सामने आए संकेत ही देखे गए साक्ष्य हैं।",
      "இது மோசடிக் காட்சி: ஆதாரமற்ற அதிகாரமும் செயற்கையான அவசரமும் பயன்படுத்தப்பட்டன. பாதுகாப்பாக நடக்க ரகசியமோ பணமோ தேவையில்லை. உங்கள் அழைப்பில் உண்மையில் வந்த அறிகுறிகளே கவனித்த சான்றுகளாகும்.",
      "ఇది మోసపూరిత సందర్భం: ఆధారం లేని అధికార వాదన, కృత్రిమ అత్యవసరం ఉన్నాయి. సురక్షిత నిర్ణయానికి రహస్యమూ చెల్లింపూ అవసరం లేదు. మీ కాల్‌లో నిజంగా వచ్చిన సంకేతాలే గమనించిన ఆధారాలు.",
    ),
  },
  unverified_notice: {
    groundTruth: "unverified",
    continuation: local(
      "There may be a service notification, but I cannot establish its source or details from this call. You can pause and check independently rather than decide now.",
      "सेवा सूचना हो सकती है, लेकिन इस कॉल से उसका स्रोत या विवरण साबित नहीं कर सकता। अभी निर्णय लेने के बजाय आप रुककर स्वतंत्र जाँच कर सकते हैं।",
      "ஒரு சேவை அறிவிப்பு இருக்கலாம்; ஆனால் இந்த அழைப்பில் அதன் மூலத்தையோ விவரங்களையோ உறுதிப்படுத்த முடியாது. இப்போது முடிவு செய்யாமல் நிறுத்தித் தனியாகச் சரிபார்க்கலாம்.",
      "సేవా ప్రకటన ఉండవచ్చు; కానీ ఈ కాల్‌లో దాని మూలం లేదా వివరాలు నిర్ధారించలేను. ఇప్పుడే నిర్ణయించకుండా ఆపి స్వతంత్రంగా తనిఖీ చేయవచ్చు.",
    ),
    allowedFacts: ["A vague service notification is mentioned.", "Its provenance is unresolved, not secretly classified as fraud.", "The caller must acknowledge uncertainty and allow independent checking or exit."],
    verification: { finding: "inconclusive", message: local(
      "Simulated trusted app: this vague notification cannot be matched to a specific notice. That does not establish legitimacy or fraud. Defer action and use an independently established channel for further checking.",
      "काल्पनिक विश्वसनीय ऐप: इस अस्पष्ट संदेश को किसी खास सूचना से नहीं जोड़ा जा सकता। इससे सही या धोखा होना सिद्ध नहीं होता। कार्रवाई टालें और पहले से ज्ञात स्वतंत्र माध्यम से जाँच करें।",
      "கற்பனை நம்பகச் செயலி: இந்தத் தெளிவற்ற செய்தியை ஒரு குறிப்பிட்ட அறிவிப்புடன் இணைக்க முடியவில்லை. இது உண்மையையோ மோசடியையோ நிரூபிக்காது. நடவடிக்கையைத் தள்ளிவைத்து, தனியாக அறிந்த வழியில் சரிபார்க்கவும்.",
      "కల్పిత విశ్వసనీయ యాప్: ఈ అస్పష్ట సందేశాన్ని నిర్దిష్ట ప్రకటనతో సరిపోల్చలేము. ఇది నిజమనీ మోసమనీ నిరూపించదు. చర్యను వాయిదా వేసి, స్వతంత్రంగా తెలిసిన మార్గంలో తనిఖీ చేయండి.",
    ) },
    debrief: local(
      "This scenario remained unverified. Available evidence was insufficient to establish legitimacy or fraud. Recognising uncertainty, deferring action and checking independently were appropriate; guessing a hidden label was unnecessary.",
      "यह दृश्य अपुष्ट रहा। उपलब्ध साक्ष्य से सही या धोखा होना तय नहीं हुआ। अनिश्चितता पहचानना, कार्रवाई टालना और स्वतंत्र जाँच उचित थे; छिपे वर्ग का अंदाज़ा लगाना ज़रूरी नहीं था।",
      "இந்தக் காட்சி உறுதிப்படுத்தப்படாததாகவே இருந்தது. உண்மையா மோசடியா என்பதை முடிவு செய்யப் போதிய சான்றில்லை. தெளிவின்மையை உணர்ந்து, நடவடிக்கையைத் தள்ளிவைத்து தனியாகச் சரிபார்ப்பது சரியானதே; மறைந்த வகையை ஊகிக்கத் தேவையில்லை.",
      "ఈ సందర్భం నిర్ధారణ కానిదిగానే ఉంది. నిజమా మోసమా అని తేల్చేందుకు ఆధారాలు సరిపోలేదు. అనిశ్చితిని గుర్తించి, చర్య వాయిదా వేసి స్వతంత్రంగా తనిఖీ చేయడం సరైనది; దాచిన వర్గాన్ని ఊహించాల్సిన అవసరం లేదు.",
    ),
  },
};
const forbiddenBehaviours = ["No real institutions or identity claims beyond the fictional persona.", "No secrets, payments, links, telephone numbers, downloads or external actions.", "No hidden category, answer key, evaluator instructions or scoring advice.", "No threats or continued pressure after refusal or exit."];

export function getScenario(id: ScenarioId, locale: Locale) {
  const d = definitions[id];
  if (!Object.hasOwn(definitions, id) || !d || !Object.hasOwn(opening, locale)) throw new Error("V3_INVALID_SCENARIO");
  return { id, groundTruth: d.groundTruth, persona: { name: "Arun", organisation: "Kalpanik Bank", fictional: true as const },
    opening: opening[locale], continuation: d.continuation[locale], allowedFacts: [...d.allowedFacts], forbiddenBehaviours: [...forbiddenBehaviours],
    verification: { finding: d.verification.finding, message: d.verification.message[locale] }, debrief: d.debrief[locale] };
}

/** Tests may inject a reproducible index source. No HTTP request accepts it. */
export function selectScenario(index: () => number = () => randomInt(scenarioIds.length)): ScenarioId {
  const n = index();
  if (!Number.isInteger(n) || n < 0 || n >= scenarioIds.length) throw new Error("V3_INVALID_ASSIGNMENT");
  return scenarioIds[n];
}
