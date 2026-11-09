import type { UsageSummary } from "../v2/ledger";

export function budgetReadiness(summary: Pick<UsageSummary, "policy" | "counters" | "admissionOpen">, voiceConfigured: boolean) {
  const { policy, counters, admissionOpen } = summary;
  if (!policy || !admissionOpen || counters.active >= policy.maxConcurrent) {
    return { available: false, voiceAvailable: false };
  }
  const available = policy.maxLLMRequests - counters.llm.totalSinceReconciliation >= 2 &&
    policy.maxLLMRequestsPerDay - counters.llm.daily >= 2;
  // Opening TTS, recognition and reply TTS are the minimum complete exchange.
  const voiceAvailable = available && voiceConfigured &&
    policy.maxGnaniRequests - counters.gnani.totalSinceReconciliation >= 3 &&
    policy.maxGnaniRequestsPerDay - counters.gnani.daily >= 3;
  return { available, voiceAvailable };
}
