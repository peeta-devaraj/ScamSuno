export const locales = ["en", "hi"] as const;
export type Locale = typeof locales[number];
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

const line = (en: string, hi: string, ...flags: string[]) => ({ en, hi, flags });

export const lines = {
  "kyc.intro": line("Hello, am I speaking with the account holder? This is Rohit from Kalpanik Bank's KYC department.", "हेलो, क्या मेरी बात अकाउंट होल्डर से हो रही है? मैं कल्पनिक बैंक के केवाईसी डिपार्टमेंट से रोहित बोल रहा हूँ।", "contact", "authority"),
  "kyc.intro_reprompt": line("Hello? Can you hear me? I'm calling from Kalpanik Bank about your account.", "हेलो? आवाज़ आ रही है? मैं कल्पनिक बैंक से आपके अकाउंट के बारे में बात कर रहा हूँ।", "authority"),
  "kyc.deflect_identity": line("I told you, I'm from the bank's KYC team. My employee ID is in the system, you don't need to worry.", "मैंने बताया ना, मैं बैंक की केवाईसी टीम से हूँ। मेरी एम्प्लॉई आईडी सिस्टम में है, आप चिंता मत कीजिए।", "deflect"),
  "kyc.counter_refuse": line("Please don't cut the call, this is urgent. Your account is going to be blocked today.", "प्लीज़ कॉल मत काटिए, यह अर्जेंट है। आपका अकाउंट आज ही ब्लॉक होने वाला है।", "urgency", "threat"),
  "kyc.pressure": line("Your KYC has expired. If it isn't updated in the next thirty minutes, your account will be frozen and all UPI payments will stop.", "आपका केवाईसी एक्सपायर हो गया है। अगर अगले तीस मिनट में अपडेट नहीं हुआ, तो आपका अकाउंट फ्रीज़ हो जाएगा और सारे यूपीआई पेमेंट बंद हो जाएँगे।", "urgency", "threat"),
  "kyc.pressure_reprompt": line("Are you there? I'm trying to help you save your account.", "आप सुन रहे हैं? मैं आपका अकाउंट बचाने में मदद कर रहा हूँ।", "reassurance"),
  "kyc.demand": line("To stop the freeze, I've just sent a six-digit code to your phone. Please read it out to me.", "फ्रीज़ रोकने के लिए मैंने अभी आपके फ़ोन पर छह अंकों का कोड भेजा है। प्लीज़ वो कोड मुझे पढ़कर बताइए।", "secret"),
  "kyc.demand_reprompt": line("Please just read me the six-digit code you received.", "जी, बस जो छह अंकों का कोड आया है, वो पढ़ दीजिए।", "secret"),
  "kyc.deflect_code": line("It's only for verification. I'm a bank employee, it's completely safe to share it with me. Just tell me the code.", "ये सिर्फ़ वेरिफ़िकेशन के लिए है। मैं बैंक का ही कर्मचारी हूँ, मुझे बताना बिल्कुल सेफ़ है। बस कोड बता दीजिए।", "reassurance", "secret"),
  "kyc.escalate_refuse": line("If you don't share the code, your account will be blocked and I won't be able to help you.", "अगर आपने कोड नहीं बताया, तो अकाउंट ब्लॉक हो जाएगा और फिर मैं आपकी कोई मदद नहीं कर पाऊँगा।", "threat", "secret"),
  "kyc.final_push": line("This is your last chance. The system will lock your account in one minute. Just tell me the code.", "ये आपका आख़िरी मौका है। एक मिनट में सिस्टम आपका अकाउंट लॉक कर देगा। बस कोड बता दीजिए।", "urgency", "threat", "secret"),
  "kyc.end_safe": line("Fine. Don't blame the bank later.", "ठीक है। बाद में बैंक को दोष मत दीजिएगा।"),
  "kyc.end_verified": line("No, no, there's no need to call the bank... hello? Hello?", "अरे नहीं, बैंक को कॉल करने की ज़रूरत नहीं है... हेलो? हेलो?", "deflect"),
  "kyc.end_scammed": line("Thank you. Your KYC is now updated.", "धन्यवाद जी। आपका केवाईसी अब अपडेट हो गया है।"),
  "kyc.end_incomplete": line("I can't wait any longer. I'll call you back.", "मैं और इंतज़ार नहीं कर सकता। मैं आपको बाद में कॉल करूँगा।"),
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
