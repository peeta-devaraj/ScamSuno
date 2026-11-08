import { maskNumbers } from '../../domain/numbers';

export const SENSITIVE_CONTENT_OMITTED = '[Sensitive information omitted]';

// Conservative lexical detection of explicit credential-value disclosures, not
// a general PII classifier. Unsupported spellings/obfuscations remain a limit.
// Whole utterances are omitted so value tails cannot survive partial matching.
const valueDisclosure = [
  /\b(?:password|passcode|pin|otp|cvv|verification\s+code|security\s+code)\s*(?:is|are|equals?|:|=)\s*(?!(?:not|never|private|confidential|unknown|required|needed)\b)\S+/iu,
  /\b(?:my|our)\s+(?:password|passcode|pin|otp|cvv)\s+[\p{N}]+/iu,
  /\b(?:mera|meri)\s+(?:password|passcode|pin|otp|cvv|code)\s+(?:hai\s+)?(?!(?:nahi|nahin|mat|private)\b)\S+\s+hai\b/iu,
  /\b(?:mera|meri)\s+(?:password|passcode|pin|otp|cvv|code)\s+hai\s+(?!(?:nahi|nahin)\b)\S+/iu,
  /(?:पासवर्ड|पिन|ओटीपी|सीवीवी|सुरक्षा\s*कोड)\s*(?:है|हैं|:|=)\s*(?!नहीं|नही)\S+/u,
  /(?:मेरा|मेरी)\s*(?:पासवर्ड|पिन|ओटीपी|सीवीवी|कोड)\s+(?!नहीं|नही|साझा)[^.!?।]{1,80}\s+(?:है|हैं)/u,
  /(?:என்|எனது)\s*(?:கடவுச்சொல்|கடவுச்\s*சொல்|பின்|ஓ[.\s]*டி[.\s]*பி|குறியீடு)(?:\s*[:=]\s*|\s+)(?!பகிர|சொல்ல|தர|இல்லை|தேவையில்லை)\S+/u,
  /(?:నా|నాది)\s*(?:పాస్[\s\u200c\u200d-]*వర్డ్|పిన్|ఓటీపీ|కోడ్)(?:\s*[:=]\s*|\s+)(?!ఇవ్వను|చెప్పను|పంచుకోను|కాదు|లేదు)\S+/u,
];
export function redactExplicitSecrets(text: string): string {
  const normalized = text.normalize('NFC');
  return valueDisclosure.some(pattern => pattern.test(normalized)) ? SENSITIVE_CONTENT_OMITTED : text;
}
export function retainReplyText(text: string): string {
  return maskNumbers(redactExplicitSecrets(text));
}
