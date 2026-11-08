import { maskNumbers } from '../../domain/numbers';

export const SENSITIVE_CONTENT_OMITTED = '[Sensitive information omitted]';

// Withhold credential-bearing utterances by default, rather than trying to
// identify every possible value syntax. Only whole, value-free reviewed forms
// pass unchanged. A refusal followed by a value is still withheld, not graded as
// unsafe. This is deliberately conservative, not a general PII/obfuscation filter.
const credentialReference = /\b(?:pass\s*word|passcode|passphrase|pin|otp|cvv|credentials?|code|kadavuchol|kadavuchchol|kadavusol|kadavuchsol|passwordu|paasword|pasward)\b|\b(?:o[.\s]*t[.\s]*p|p[.\s]*i[.\s]*n|c[.\s]*v[.\s]*v)\b|पासवर्ड|पासकोड|पिन|ओटीपी|ओ[.\s]*टी[.\s]*पी|सीवीवी|कोड|கடவுச்?\s*சொல்|கடவுச்சொல்|பாஸ்வேர்ட்|பாஸ்வர்ட்|பின்|ஓ[.\s]*டி[.\s]*பி|குறியீ|పాస్[\s-]*వర్డ్|పాస్వర్డ్|పిన్|ఓటీపీ|ఓ[.\s]*టి[.\s]*పి|కోడ్/iu;
const safeCredentialForms = [
  /^(?:i\s+(?:(?:will not|won['’]t|never|do not|don['’]t)\s+(?:share|give|provide|tell|disclose)|refuse to\s+(?:share|give|provide|tell|disclose))\s+(?:my|the|any)\s+(?:password|passcode|pin|otp|cvv|code)|did you ask for my password|my password is not required)[.!?\s]*$/iu,
  /^(?:मैं\s+(?:(?:अपना|मेरा)\s+)?(?:पासवर्ड|पिन|ओटीपी|कोड)\s+(?:साझा नहीं करूँगा|साझा नहीं करूंगा|नहीं बताऊँगा|नहीं बताऊंगा|नहीं दूँगा|नहीं दूंगा))[।.!\s]*$/u,
  /^(?:நான்\s+|என்\s+)?(?:கடவுச்சொல்லைச்|கடவுச்சொல்லை|குறியீட்டைச்|குறியீட்டை)\s*(?:சொல்ல|பகிர|தர)\s*மாட்டேன்[.!\s]*$/u,
  /^(?:(?:నా|నేను)\s+)?(?:పాస్[\s-]*వర్డ్|పాస్వర్డ్|పిన్|ఓటీపీ|కోడ్)\s*(?:చెప్పను|ఇవ్వను|పంచుకోను)[.!\s]*$/u,
  /^(?:main\s+(?:(?:apna|mera)\s+)?(?:password|pin|otp|code)\s+nahi\s+(?:dunga|bataunga)|naan\s+(?:password|kadavuchol)\s+solla\s+maatten|nenu\s+(?:password|pin|otp|code)\s+cheppanu)[.!\s]*$/iu,
];
export function redactExplicitSecrets(text: string): string {
  // Fold full-width characters and remove zero-width separators for detection.
  const normalized = text.normalize('NFKC').replace(/\p{Cf}/gu, '').trim();
  if (!credentialReference.test(normalized)) return text;
  return safeCredentialForms.some(pattern => pattern.test(normalized)) ? text : SENSITIVE_CONTENT_OMITTED;
}
export function retainReplyText(text: string): string {
  return maskNumbers(redactExplicitSecrets(text));
}
