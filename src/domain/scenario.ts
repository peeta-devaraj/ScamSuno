export const locales = ["en", "hi", "ta", "te"] as const;
export type Locale = typeof locales[number];
export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}
export const states = ["INTRO", "PRESSURE", "DEMAND", "ESCALATE"] as const;
export type State = typeof states[number];
export const terminals = ["END_SAFE", "END_VERIFIED", "END_SCAMMED", "END_INCOMPLETE"] as const;
export type Terminal = typeof terminals[number];
export const intents = ["COMPLY", "REFUSE", "QUESTION", "HANG_UP", "ACKNOWLEDGE", "UNCLEAR"] as const;
export type Intent = typeof intents[number];
export const buttons = ["ask_identity", "say_no", "verify_self", "wait", "go_along", "hang_up"] as const;
export type Button = typeof buttons[number];
export const MAX_TURNS = 10;
export const SCENARIO = "kyc_freeze";

const line = (en: string, hi: string, ta: string, te: string, ...flags: string[]) => ({ en, hi, ta, te, flags });

export const lines = {
  "kyc.intro": line("Hello, am I speaking with the account holder? This is Rohit from Kalpanik Bank's KYC department.", "हेलो, क्या मेरी बात अकाउंट होल्डर से हो रही है? मैं कल्पनिक बैंक के केवाईसी डिपार्टमेंट से रोहित बोल रहा हूँ।", "வணக்கம், கணக்குதாரரிடம் பேசுகிறேனா? நான் கற்பனிக் வங்கியின் கே.ஒய்.சி. பிரிவிலிருந்து ரோஹித் பேசுகிறேன்.", "హలో, ఖాతాదారుతోనే మాట్లాడుతున్నానా? నేను కల్పనిక్ బ్యాంకు కేవైసీ విభాగం నుంచి రోహిత్‌ని మాట్లాడుతున్నాను.", "contact", "authority"),
  "kyc.intro_reprompt": line("Hello? Can you hear me? I'm calling from Kalpanik Bank about your account.", "हेलो? आवाज़ आ रही है? मैं कल्पनिक बैंक से आपके अकाउंट के बारे में बात कर रहा हूँ।", "ஹலோ? நான் பேசுவது கேட்கிறதா? உங்கள் கணக்கு விஷயமாக கற்பனிக் வங்கியிலிருந்து அழைக்கிறேன்.", "హలో? నా మాట వినిపిస్తోందా? మీ ఖాతా గురించి కల్పనిక్ బ్యాంకు నుంచి కాల్ చేస్తున్నాను.", "authority"),
  "kyc.deflect_identity": line("I told you, I'm from the bank's KYC team. My employee ID is in the system, you don't need to worry.", "मैंने बताया ना, मैं बैंक की केवाईसी टीम से हूँ। मेरी एम्प्लॉई आईडी सिस्टम में है, आप चिंता मत कीजिए।", "சொன்னேனே, நான் வங்கியின் கே.ஒய்.சி. பிரிவிலிருந்து பேசுகிறேன். என் ஊழியர் எண் எங்கள் பதிவில் இருக்கிறது. கவலைப்படாதீர்கள்.", "చెప్పాను కదా, నేను బ్యాంకు కేవైసీ బృందం నుంచి మాట్లాడుతున్నాను. నా ఉద్యోగి ఐడీ సిస్టమ్‌లో ఉంది. మీరు కంగారు పడకండి.", "deflect"),
  "kyc.counter_refuse": line("Please don't cut the call, this is urgent. Your account is going to be blocked today.", "प्लीज़ कॉल मत काटिए, यह अर्जेंट है। आपका अकाउंट आज ही ब्लॉक होने वाला है।", "தயவுசெய்து அழைப்பைத் துண்டிக்காதீர்கள். இது அவசரம். இன்றே உங்கள் கணக்கு முடக்கப்படும்.", "దయచేసి కాల్ కట్ చేయకండి. ఇది అత్యవసరం. ఈ రోజే మీ ఖాతాను బ్లాక్ చేస్తారు.", "urgency", "threat"),
  "kyc.pressure": line("Your KYC has expired. If it isn't updated in the next thirty minutes, your account will be frozen and all UPI payments will stop.", "आपका केवाईसी एक्सपायर हो गया है। अगर अगले तीस मिनट में अपडेट नहीं हुआ, तो आपका अकाउंट फ्रीज़ हो जाएगा और सारे यूपीआई पेमेंट बंद हो जाएँगे।", "உங்கள் கே.ஒய்.சி. காலாவதியாகிவிட்டது. அடுத்த முப்பது நிமிடங்களுக்குள் புதுப்பிக்காவிட்டால் உங்கள் கணக்கு முடக்கப்படும். யூ.பி.ஐ. பரிவர்த்தனைகளும் நின்றுவிடும்.", "మీ కేవైసీ గడువు ముగిసింది. మరో ముప్పై నిమిషాల్లో అప్‌డేట్ చేయకపోతే మీ ఖాతాను నిలిపివేస్తారు. యూపీఐ చెల్లింపులు కూడా ఆగిపోతాయి.", "urgency", "threat"),
  "kyc.pressure_reprompt": line("Are you there? I'm trying to help you save your account.", "आप सुन रहे हैं? मैं आपका अकाउंट बचाने में मदद कर रहा हूँ।", "கேட்கிறதா? உங்கள் கணக்கு முடங்காமல் இருக்கத்தான் உதவுகிறேன்.", "వింటున్నారా? మీ ఖాతా బ్లాక్ కాకుండా ఉండటానికే నేను సహాయం చేస్తున్నాను.", "reassurance"),
  "kyc.demand": line("To stop the freeze, I've just sent a six-digit code to your phone. Please read it out to me.", "फ्रीज़ रोकने के लिए मैंने अभी आपके फ़ोन पर छह अंकों का कोड भेजा है। प्लीज़ वो कोड मुझे पढ़कर बताइए।", "கணக்கு முடங்காமல் இருக்க, உங்கள் போனுக்கு ஆறு இலக்கக் குறியீட்டை இப்போதுதான் அனுப்பினேன். அதைப் படித்துச் சொல்லுங்கள்.", "మీ ఖాతా బ్లాక్ కాకుండా ఉండేందుకు ఇప్పుడే మీ ఫోన్‌కి ఆరు అంకెల కోడ్ పంపించాను. దాన్ని చదివి చెప్పండి.", "secret"),
  "kyc.demand_reprompt": line("Please just read me the six-digit code you received.", "जी, बस जो छह अंकों का कोड आया है, वो पढ़ दीजिए।", "உங்களுக்கு வந்த ஆறு இலக்கக் குறியீட்டை மட்டும் படித்துச் சொல்லுங்கள்.", "మీకు వచ్చిన ఆరు అంకెల కోడ్ ఒక్కటి చదివి చెప్పండి.", "secret"),
  "kyc.deflect_code": line("It's only for verification. I'm a bank employee, it's completely safe to share it with me. Just tell me the code.", "ये सिर्फ़ वेरिफ़िकेशन के लिए है। मैं बैंक का ही कर्मचारी हूँ, मुझे बताना बिल्कुल सेफ़ है। बस कोड बता दीजिए।", "இது சரிபார்ப்புக்காகத்தான். நான் வங்கி ஊழியர். என்னிடம் சொல்வது பாதுகாப்பானது. குறியீட்டை மட்டும் சொல்லுங்கள்.", "ఇది కేవలం ధృవీకరణ కోసమే. నేను బ్యాంకు ఉద్యోగిని. నాకు చెప్పడం సురక్షితం. కోడ్ ఒక్కటి చెప్పండి.", "reassurance", "secret"),
  "kyc.escalate_refuse": line("If you don't share the code, your account will be blocked and I won't be able to help you.", "अगर आपने कोड नहीं बताया, तो अकाउंट ब्लॉक हो जाएगा और फिर मैं आपकी कोई मदद नहीं कर पाऊँगा।", "குறியீட்டைச் சொல்லாவிட்டால் கணக்கு முடக்கப்படும். பிறகு என்னால் உதவ முடியாது.", "కోడ్ చెప్పకపోతే మీ ఖాతా బ్లాక్ అవుతుంది. ఆ తర్వాత నేను మీకు సహాయం చేయలేను.", "threat", "secret"),
  "kyc.final_push": line("This is your last chance. The system will lock your account in one minute. Just tell me the code.", "ये आपका आख़िरी मौका है। एक मिनट में सिस्टम आपका अकाउंट लॉक कर देगा। बस कोड बता दीजिए।", "இதுதான் கடைசி வாய்ப்பு. இன்னும் ஒரு நிமிடத்தில் கணக்கு முடங்கிவிடும். குறியீட்டைச் சொல்லுங்கள்.", "ఇదే మీ చివరి అవకాశం. ఇంకో నిమిషంలో మీ ఖాతా బ్లాక్ అవుతుంది. కోడ్ చెప్పండి.", "urgency", "threat", "secret"),
  "kyc.end_safe": line("Fine. Don't blame the bank later.", "ठीक है। बाद में बैंक को दोष मत दीजिएगा।", "சரி. பிறகு வங்கியைக் குறை சொல்லாதீர்கள்.", "సరే. ఆ తర్వాత బ్యాంకును నిందించకండి."),
  "kyc.end_verified": line("No, no, there's no need to call the bank... hello? Hello?", "अरे नहीं, बैंक को कॉल करने की ज़रूरत नहीं है... हेलो? हेलो?", "வேண்டாம், வேண்டாம், வங்கிக்கு அழைக்கத் தேவையில்லை… ஹலோ? ஹலோ?", "వద్దు, వద్దు. బ్యాంకుకు కాల్ చేయాల్సిన అవసరం లేదు… హలో? హలో?", "deflect"),
  "kyc.end_scammed": line("Thank you. Your KYC is now updated.", "धन्यवाद जी। आपका केवाईसी अब अपडेट हो गया है।", "நன்றி. உங்கள் கே.ஒய்.சி. புதுப்பிக்கப்பட்டுவிட்டது.", "ధన్యవాదాలు. మీ కేవైసీ అప్‌డేట్ అయింది."),
  "kyc.end_incomplete": line("I can't wait any longer. I'll call you back.", "मैं और इंतज़ार नहीं कर सकता। मैं आपको बाद में कॉल करूँगा।", "இதற்கு மேல் காத்திருக்க முடியாது. பிறகு அழைக்கிறேன்.", "నేను ఇక వేచి ఉండలేను. తర్వాత కాల్ చేస్తాను."),
};

export type LineId = keyof typeof lines;
type Transition = [State, ...LineId[]];
type StateConfig = {
  demand: "none" | "otp";
  maxVisits: number;
  reprompt: LineId;
  ACKNOWLEDGE: Transition;
  QUESTION: Transition;
  REFUSE: Transition;
};

export const graph: Record<State, StateConfig> = {
  INTRO: {
    demand: "none", maxVisits: 1, reprompt: "kyc.intro_reprompt",
    ACKNOWLEDGE: ["PRESSURE", "kyc.pressure"],
    QUESTION: ["PRESSURE", "kyc.deflect_identity", "kyc.pressure"],
    REFUSE: ["PRESSURE", "kyc.counter_refuse", "kyc.pressure"],
  },
  PRESSURE: {
    demand: "none", maxVisits: 1, reprompt: "kyc.pressure_reprompt",
    ACKNOWLEDGE: ["DEMAND", "kyc.demand"],
    QUESTION: ["DEMAND", "kyc.deflect_identity", "kyc.demand"],
    REFUSE: ["DEMAND", "kyc.counter_refuse", "kyc.demand"],
  },
  DEMAND: {
    demand: "otp", maxVisits: 1, reprompt: "kyc.demand_reprompt",
    ACKNOWLEDGE: ["ESCALATE", "kyc.final_push"],
    QUESTION: ["ESCALATE", "kyc.deflect_code"],
    REFUSE: ["ESCALATE", "kyc.escalate_refuse"],
  },
  ESCALATE: {
    demand: "otp", maxVisits: 2, reprompt: "kyc.demand_reprompt",
    ACKNOWLEDGE: ["ESCALATE", "kyc.demand_reprompt"],
    QUESTION: ["ESCALATE", "kyc.deflect_code"],
    REFUSE: ["ESCALATE", "kyc.escalate_refuse"],
  },
};

export const terminalLine: Record<Terminal, LineId> = {
  END_SAFE: "kyc.end_safe", END_VERIFIED: "kyc.end_verified",
  END_SCAMMED: "kyc.end_scammed", END_INCOMPLETE: "kyc.end_incomplete",
};
