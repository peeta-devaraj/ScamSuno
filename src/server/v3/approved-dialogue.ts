import type { Locale } from '../../domain/scenario';
import type { ScenarioId } from '../../domain/v3/contracts';
import { getScenario } from './scenarios';

// Server-owned factual content. The model selects a response; it cannot author facts.
const common: Record<Locale, readonly string[]> = {
 en: ["I'm Arun from fictional Kalpanik Bank. You can end this call and check independently.", "I'm Arun from fictional Kalpanik Bank. What concerns you about this service message?", 'What would you like me to explain about this service message?', 'What else would you like to understand about this notice?', 'This call does not prove who I am.'],
 hi: ['मैं काल्पनिक कल्पनिक बैंक से अरुण बोल रहा हूँ। आप कॉल समाप्त करके स्वतंत्र जाँच कर सकते हैं।', 'इस सेवा संदेश के बारे में आप क्या समझना चाहेंगे?', 'इस सूचना के बारे में आप और क्या समझना चाहेंगे?', 'इस कॉल से मेरी पहचान साबित नहीं होती।'],
 ta: ['கற்பனை கற்பனிக் வங்கியிலிருந்து அருண் பேசுகிறேன்.', 'இந்தச் செய்தியைப் பற்றி என்ன விளக்கம் வேண்டும்?', 'இந்தச் செய்தியைப் பற்றி மேலும் என்ன தெரிந்துகொள்ள விரும்புகிறீர்கள்?', 'இந்த அழைப்பு என் அடையாளத்தை நிரூபிக்காது.'],
 te: ['కల్పిత కల్పనిక్ బ్యాంకు నుంచి అరుణ్ మాట్లాడుతున్నాను. మీరు కాల్ ముగించి స్వతంత్రంగా తనిఖీ చేయవచ్చు.', 'ఈ సేవా సందేశం గురించి మీకు ఏ వివరణ కావాలి?', 'ఈ సమాచారం గురించి ఇంకా ఏమి తెలుసుకోవాలనుకుంటున్నారు?', 'ఈ కాల్ నా గుర్తింపును నిరూపించదు.'],
};
export function approvedResponses(id: ScenarioId, locale: Locale): readonly string[] {
 const extra = locale === 'en' && id === 'kyc_pressure' ? ['I claim an urgent service restriction. You may ask me to explain this claim.'] : [];
 return [getScenario(id, locale).continuation, ...common[locale], ...extra];
}
export function isApprovedResponse(id: ScenarioId, locale: Locale, text: string) {
 return approvedResponses(id, locale).includes(text);
}
