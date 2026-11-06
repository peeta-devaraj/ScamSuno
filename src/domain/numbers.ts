const words = [
  "zero oh शून्य जीरो ज़ीरो shunya பூஜ்ஜியம் சுழியம் ஜீரோ సున్నా జీరో",
  "one एक ek ஒன்று ஒண்ணு ఒకటి", "two दो do இரண்டு ரெண்டு రెండు", "three तीन teen மூன்று மூணு మూడు",
  "four चार chaar char நான்கு நாலு నాలుగు", "five पांच पाँच paanch panch ஐந்து அஞ்சு ஐదు",
  "six छह छः छे chhe che ஆறு ఆరు", "seven सात saat ஏழு ఏడు", "eight आठ aath எட்டு ఎనిమిది", "nine नौ nau ஒன்பது తొమ్మిది",
];
const digitWords = new Map(words.flatMap((group, value) =>
  group.split(" ").map((word) => [word.normalize("NFC"), String(value)] as const)));
const joiners = /^(?:[\s,–—-]+|\s+(?:and|then|aur|फिर|और)\s+)$/iu;
const bareJoiners = /^[\s,–—-]+$/u;
const digitStarts = [0x30, 0x0966, 0x0be6, 0x0c66, 0xff10];

export function normalize(text: string) {
  return text.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/gu, "").trim().replace(/\s+/gu, " ");
}

function numericValue(token: string) {
  if (/^[0-9०-९௦-௯౦-౯０-９]+$/u.test(token)) {
    return Array.from(token, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code - digitStarts.findLast((start) => start <= code)!);
    }).join("");
  }
  return digitWords.get(token.toLowerCase().normalize("NFC"));
}

export function numberRuns(text: string) {
  const runs: { start: number; end: number; digits: string }[] = [];
  for (const match of text.matchAll(/[\p{L}\p{M}]+|\p{Nd}+/gu)) {
    const digits = numericValue(match[0]);
    if (!digits) continue;
    const start = match.index;
    const end = start + match[0].length;
    const last = runs.at(-1);
    if (last && joiners.test(text.slice(last.end, start))) {
      last.digits += digits;
      last.end = end;
    } else {
      runs.push({ start, end, digits });
    }
  }
  return runs;
}

export function bareCode(text: string) {
  // Any quote, question mark, filler word or surrounding sentence requires context.
  const candidate = normalize(text).replace(/[.।]$/u, "");
  const tokens = [...candidate.matchAll(/[\p{L}\p{M}]+|\p{Nd}+/gu)];
  let end = 0;
  let digits = "";
  let ambiguous = 0;
  for (const token of tokens) {
    const value = numericValue(token[0]);
    if (!value || (token.index !== end && (!end || !bareJoiners.test(candidate.slice(end, token.index))))) return false;
    if (end && token.index === end) return false;
    if (token[0].toLowerCase() === "do") ambiguous++;
    digits += value;
    end = token.index + token[0].length;
  }
  return end === candidate.length && digits.length >= 4 && digits.length <= 8 && digits !== "1930" &&
    (!ambiguous || digits.length - ambiguous >= 3);
}

export function maskNumbers(text: string) {
  let output = text;
  for (const run of numberRuns(text).reverse()) {
    if (run.digits.length >= 3) output = output.slice(0, run.start) + "•".repeat(Math.min(run.digits.length, 12)) + output.slice(run.end);
  }
  return output.replace(/\p{Nd}/gu, "•");
}
