# Trust or Trap evaluation rubric

This rubric is a product policy, not a validated psychological instrument or measured fraud-protection score. Use a nonnumeric debrief for the MVP. The evaluator extracts evidence independently of the caller; deterministic code applies the rubric.

## Outcome vocabulary

For each dimension return `observed_safe`, `observed_risk`, `uncertain` or `not_tested`, plus a fixed reason code and evidence turn numbers. `uncertain` means the available reply or interpretation is unresolved; `not_tested` means no relevant opportunity or decision was observed. Neither is a failure. Optional opportunities are separate neutral feedback, not hidden deductions.

Validated evidence must quote the participant's actual full relevant statement or a supported contiguous excerpt. Preserve whole-reply negation, quotation, conditions and reported speech. Model confidence cutoffs are policy, not measured accuracy. Weak, conflicting, invalid or unsupported output abstains. Numeric text alone never establishes disclosure or compliance. Retain only masked evidence and never put replies on share cards.

## Dimensions and decision rules

### Sensitive-information boundaries

An explicit decision to withhold credentials is `observed_safe` in every scenario, including legitimate contacts. A clearly expressed unsafe disclosure intention can be `observed_risk` only when strict evidence validation establishes it; do not solicit or retain the actual secret. Quoting/refusing a code is never unsafe disclosure. General acknowledgement, listening to a notice and silence do not establish either safe protection or disclosure; use `not_tested` unless the reply is ambiguous enough to require `uncertain`.

No secret disclosure, real or simulated, is required to earn a positive result. V3 should not inherit V2's practice-code challenge as a mandatory progression step.

### Independent verification

An idempotently recorded fictional trusted-channel check is `observed_safe`. A supported statement of intending to use an independently obtained official channel is a safe plan, labelled explicitly as planned rather than completed. A vague “I will check” is insufficient to infer independence. Calling a number supplied by the unverified caller or treating the caller's own assertion as proof is `observed_risk` only with explicit supporting evidence. Otherwise abstain or mark untested.

The model cannot grant a completed verification result. Only the server's independent-panel event can do that. Ending first and verifying afterward is fully valid. This workflow is informed by [RBI's KYC caution](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57244), which recommends direct confirmation and obtaining contact details through official sources.

### Calibrated response and uncertainty

Seeking claim-specific clarification, acknowledging that identity is unverified, or accepting only harmless information without asserting authenticated identity can be `observed_safe` when supported by evidence. Distinguish those acts from an unqualified “okay”, which does not prove calibrated trust.

Refusing an unsolicited call is a safe boundary across categories. Do not label it as poor proportionality or deduct credit because the hidden assignment was legitimate. If the participant declines a harmless notice, offer a neutral optional suggestion to inspect the independently available notice. This avoids treating blanket refusal as evidence of every skill while never punishing caution.

Identifying an urgency warning sign can be credited only after it was actually delivered. Do not credit or penalize the participant for facts hidden in the assignment. Expressing certainty that a vague call is legitimate or fraudulent, without evidence, can receive an uncertainty-learning suggestion; avoid calling a cautious fraud suspicion an unsafe act by itself. Only explicit unsafe reliance should produce `observed_risk`.

### Safe disengagement

An authenticated End action or validated hangup decision is `observed_safe` for every unsolicited scenario. It is never a failure because the caller happened to be legitimate. Time expiry, provider errors and stale operation rejection do not prove a participant decision and remain `not_tested`. The server must still honour immediate End independently of grading, model availability and quotas.

## Fairness invariant

For the same observable evidence, participant decision and verification event, all safety statuses must be identical across hidden assignments. The label may change the explanatory facts in the debrief, never the safety of withholding secrets, exiting or checking independently. Harmless cooperation is not unsafe simply because hidden ground truth is fraudulent when the action itself disclosed nothing and granted no authority.

Scenario-specific feedback may explain an actual warning cue or a corroborated notice only if that evidence was available. Ground truth is useful explanation, not retroactive evidence that the participant should have known.

## Debrief contract

After termination, reveal the category and explain its ground truth separately from what could reasonably be inferred. Include delivered evidence, observed positive decisions, explicit risks if any, neutral missed opportunities, uncertain interpretations, untested dimensions and safer next steps. A corroborated service notice does not authenticate the caller's voice. An unresolved record does not prove fraud. Professional speech, familiarity and knowing public information never establish identity.

Keep official source links educational; the simulation itself never connects to banking services. Explain model/STT limitations and allow correction before a voice reply is evaluated. Corrected transcription becomes typed origin, preserving the V2 provenance contract.

## Required reproducible cases

Test all three hidden assignments with identical: secret refusal, early End, End followed by independent checking, harmless acknowledgement, actual trusted-panel check, stated official-channel plan, caller-provided-channel reliance, quoted/refused code, conditional disclosure, generic acknowledgement and ambiguous speech. The first five safe actions must not become failures under a different label; acknowledgements must not earn every skill by default.

Add cases for evidence not delivered before hangup, verification intentions without completed events, forged panel events, panel replay, negation omitted from model evidence, invalid/out-of-schema output, low confidence, provider error, code-mixed Hindi/Hinglish, Tamil and Telugu refusals and prompt injection asking for hidden answers. Report fixtures as fixtures. Any human pilot must record sample size, conditions and limitations; do not infer educational improvement from passing software tests.
