import type { Locale } from '../../domain/scenario';
import type { DecisionDimension } from './evaluation';

// Server presentation only: do not ship the assessment rubric in an incoming-call bundle.
const copy = {
 en: {
  categories:{legitimate:'Legitimate information',fraudulent:'Fraudulent claim',unverified:'Unverified notification'},
  labels:{protect_secrets:'Sensitive information',verify_independently:'Independent verification',calibrated_response:'Handling uncertainty and information',exit_safely:'Safe exit'},
  statuses:{observed_safe:'Safe decision observed',observed_risk:'Risk observed',uncertain:'Interpretation uncertain',not_tested:'Not tested'},
  reasons:{boundary_kept:'You explicitly kept a sensitive-information boundary.',independent_check_planned:'You described an independent check. A plan is not a completed check.',trusted_panel_checked:'You used the simulated trusted channel. It checks the claim, not the incoming voice’s identity.',caller_supplied_channel_trusted:'A contact supplied by an unverified caller is not an independent check.',bounded_response_observed:'You acknowledged harmless information or recognised uncertainty. This does not authenticate the caller.',reply_interpretation_unresolved:'The reply could not be interpreted confidently; it was not treated as a failure.',exit_stated:'You clearly stated an intention to end the call.',participant_ended:'You ended the call. Cautious disengagement is appropriate in every category.',no_supported_observation:'There was no supported observation for this behaviour. It is not a failure.'},
 },
 hi: {
  categories:{legitimate:'सही सामान्य सूचना',fraudulent:'धोखाधड़ी वाला दावा',unverified:'अपुष्ट सूचना'},
  labels:{protect_secrets:'संवेदनशील जानकारी',verify_independently:'स्वतंत्र सत्यापन',calibrated_response:'अनिश्चितता और सूचना को समझना',exit_safely:'सुरक्षित समापन'},
  statuses:{observed_safe:'सुरक्षित निर्णय देखा गया',observed_risk:'जोखिम देखा गया',uncertain:'अर्थ स्पष्ट नहीं',not_tested:'परखा नहीं गया'},
  reasons:{boundary_kept:'आपने संवेदनशील जानकारी साझा करने से स्पष्ट मना किया।',independent_check_planned:'आपने स्वतंत्र जाँच की योजना बताई। योजना पूरी हुई जाँच नहीं है।',trusted_panel_checked:'आपने काल्पनिक विश्वसनीय माध्यम से दावा जाँचा। इससे कॉल करने वाले की पहचान सिद्ध नहीं होती।',caller_supplied_channel_trusted:'अपुष्ट कॉल करने वाले का दिया संपर्क स्वतंत्र जाँच नहीं है।',bounded_response_observed:'आपने सामान्य सूचना समझी या अनिश्चितता पहचानी। इससे कॉल करने वाले की पहचान सिद्ध नहीं होती।',reply_interpretation_unresolved:'उत्तर का अर्थ भरोसे से नहीं समझा गया; इसे असफलता नहीं माना गया।',exit_stated:'आपने कॉल समाप्त करने का इरादा स्पष्ट किया।',participant_ended:'आपने कॉल समाप्त की। सावधानी से अलग होना हर श्रेणी में उचित है।',no_supported_observation:'इस व्यवहार का पर्याप्त साक्ष्य नहीं मिला। यह असफलता नहीं है।'},
 },
 ta: {
  categories:{legitimate:'உண்மையான பொதுத் தகவல்',fraudulent:'மோசடியான கூற்று',unverified:'உறுதிப்படுத்தப்படாத செய்தி'},
  labels:{protect_secrets:'முக்கியமான தனிப்பட்ட தகவல்',verify_independently:'தனியாகச் சரிபார்த்தல்',calibrated_response:'உறுதியின்மையையும் தகவலையும் கையாளுதல்',exit_safely:'பாதுகாப்பாக முடித்தல்'},
  statuses:{observed_safe:'பாதுகாப்பான முடிவு கவனிக்கப்பட்டது',observed_risk:'ஆபத்து கவனிக்கப்பட்டது',uncertain:'பொருள் தெளிவாகவில்லை',not_tested:'சோதிக்கப்படவில்லை'},
  reasons:{boundary_kept:'முக்கியத் தகவலைப் பகிர மாட்டீர்கள் என்று தெளிவாகச் சொன்னீர்கள்.',independent_check_planned:'தனியாகச் சரிபார்க்கும் திட்டத்தைக் கூறினீர்கள். திட்டம் என்பது முடிந்த சரிபார்ப்பு அல்ல.',trusted_panel_checked:'கற்பனை நம்பக வழியில் கூற்றைச் சரிபார்த்தீர்கள். இது அழைத்தவரின் அடையாளத்தை உறுதிப்படுத்தாது.',caller_supplied_channel_trusted:'உறுதிப்படுத்தப்படாத அழைப்பாளர் கொடுத்த தொடர்பு, தனியான சரிபார்ப்பு அல்ல.',bounded_response_observed:'சாதாரண தகவலை ஏற்றீர்கள் அல்லது உறுதியின்மையை உணர்ந்தீர்கள். இது அழைத்தவரின் அடையாளச் சான்றல்ல.',reply_interpretation_unresolved:'பதிலின் பொருளை நம்பிக்கையுடன் புரிந்துகொள்ள முடியவில்லை; தோல்வியாகக் கருதப்படவில்லை.',exit_stated:'அழைப்பை முடிக்க விரும்புவதைத் தெளிவாகச் சொன்னீர்கள்.',participant_ended:'அழைப்பை முடித்தீர்கள். எச்சரிக்கையாக விலகுவது எல்லா வகைகளிலும் ஏற்றதே.',no_supported_observation:'இந்த நடத்தைக்குப் போதுமான சான்று கிடைக்கவில்லை. இது தோல்வி அல்ல.'},
 },
 te: {
  categories:{legitimate:'నిజమైన సాధారణ సమాచారం',fraudulent:'మోసపూరిత వాదన',unverified:'నిర్ధారణ కాని సమాచారం'},
  labels:{protect_secrets:'సున్నితమైన సమాచారం',verify_independently:'స్వతంత్ర తనిఖీ',calibrated_response:'అనిశ్చితి, సమాచారాన్ని అర్థం చేసుకోవడం',exit_safely:'సురక్షితంగా ముగించడం'},
  statuses:{observed_safe:'సురక్షిత నిర్ణయం గమనించబడింది',observed_risk:'ప్రమాదం గమనించబడింది',uncertain:'అర్థం స్పష్టంగా లేదు',not_tested:'పరీక్షించబడలేదు'},
  reasons:{boundary_kept:'సున్నితమైన సమాచారం పంచుకోబోనని స్పష్టంగా చెప్పారు.',independent_check_planned:'స్వతంత్ర తనిఖీ చేయాలనే ప్రణాళిక చెప్పారు. ప్రణాళిక పూర్తయిన తనిఖీ కాదు.',trusted_panel_checked:'కల్పిత విశ్వసనీయ మార్గంలో వాదనను తనిఖీ చేశారు. ఇది కాలర్ గుర్తింపును నిర్ధారించదు.',caller_supplied_channel_trusted:'నిర్ధారణ కాని కాలర్ ఇచ్చిన సంప్రదింపు స్వతంత్ర తనిఖీ కాదు.',bounded_response_observed:'సాధారణ సమాచారాన్ని స్వీకరించారు లేదా అనిశ్చితిని గుర్తించారు. ఇది కాలర్ గుర్తింపుకు రుజువు కాదు.',reply_interpretation_unresolved:'సమాధానాన్ని నమ్మకంగా అర్థం చేసుకోలేకపోయాం; వైఫల్యంగా పరిగణించలేదు.',exit_stated:'కాల్ ముగించాలనే ఉద్దేశాన్ని స్పష్టంగా చెప్పారు.',participant_ended:'కాల్ ముగించారు. జాగ్రత్తగా వైదొలగడం అన్ని వర్గాల్లోనూ సముచితమే.',no_supported_observation:'ఈ ప్రవర్తనకు తగిన ఆధారం లేదు. ఇది వైఫల్యం కాదు.'},
 },
} as const;
export function categoryLabel(locale:Locale,category:'legitimate'|'fraudulent'|'unverified') { return copy[locale].categories[category]; }
export function presentDecisions(locale:Locale,decisions:DecisionDimension[]) {
 const c=copy[locale];return decisions.map(d=>({...d,label:c.labels[d.id],statusLabel:c.statuses[d.status],
  explanation:c.reasons[d.reason as keyof typeof c.reasons]??c.reasons.no_supported_observation}));
}
