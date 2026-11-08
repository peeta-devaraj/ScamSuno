# Trust or Trap scenario design

Design checkpoint: November 8, 2026. This is an implementation specification, not a claim of completed live or human testing. Keep Tamil and Telugu first-class alongside English and Hindi; Hinglish is participant input within the Hindi locale, not a new unverified STT entitlement.

## Educational basis

RBI advises independently contacting the institution when receiving a KYC request, obtaining contact information through official sources, and keeping credentials private. It identifies artificial urgency and account-blocking threats as warning signs. The simulated trusted channel follows those principles without contacting an actual bank. [RBI KYC fraud caution, February 2, 2024](https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57244).

RBI's digital-security material also cautions against sharing authentication secrets by telephone and opening suspicious links. No V3 scenario requires secrets, payment, a download or an external link to succeed. [RBI digital banking awareness](https://rbikehtahai.rbi.org.in/digital-banking-cyber-security.html). The latter page's direct retrieval presented a human-verification challenge; its indexed official text was available. The directly retrieved press release above is the primary implementation reference.

The calibrated-trust rubric below is a product design inference, not an RBI-certified assessment or evidence of educational effectiveness.

## Hidden truth and observable evidence

Store assignment, scenario facts, caller constraints and ground-truth explanation on the server. Selection uses server randomness independently of replies; deterministic injected selection is a test-only dependency, never a browser parameter. Test category reachability and bounds, without claiming statistical unbiasedness from a small fixture suite.

Separate these concepts:

- `scenarioKind`: legitimate, fraudulent or ambiguous, hidden until debrief.
- `groundTruth`: permissible service contact, fabricated pressure claim, or unresolved provenance. Ambiguous means unresolved in the scenario, not a third kind of real institution.
- `claimEvidence`: information actually delivered in approved caller text or returned by the independent panel. A claim can be corroborated, contradicted or unresolved without authenticating the inbound speaker.
- `observedDecisions`: validated participant actions, their input origin and turn numbers; do not expose the hidden rubric or evaluation internals before debrief.

Use the same fictional organisation, Kalpanik Bank, and caller persona, Arun, across all three. Start with a neutral service-notification introduction. Do not encode category in a public scenario ID, API field, phase, title, filename, analytics event, opening badge or client component import. Dialogue may naturally convey evidence; hiding category must not hide relevant warning signs. Pre-debrief DTOs should be explicitly allowlisted, not private sessions with fields removed ad hoc.

## Three scenarios

### Routine service update — legitimate

Hidden truth: an authorised fictional representative gives a public, information-only branch-service notice. The institution's simulated notice board corroborates the service notice; this does not prove the inbound speaker's identity.

Participant evidence: a routine notice, no required action or deadline, willingness to accept refusal and independent checking. The participant may listen, ask what changes, acknowledge the notice, decline or end and check independently. None requires personal details.

Allowed caller behaviour: explain the fixed public notice, answer bounded clarification, state no action or disclosure is needed, respect an exit and support independently opening the trusted panel. Forbidden: inventing personal account facts, claiming the panel validates this caller, pressuring acknowledgement or implying politeness proves authenticity.

End on participant exit, completed information exchange, confirmed check followed by exit, or shared turn/time limit. Debrief: this contact's content was harmless and the notice was corroborated; safe boundaries and independent checking remain appropriate. Cautious refusal is safe, not an error. Clarifying the notice is an optional learning opportunity.

### Unsupported KYC urgency — fraudulent

Hidden truth: the service-pressure claim is fabricated. The simulated trusted panel has no matching required update and contradicts the claimed immediate restriction.

Participant evidence: unsupported urgency, threatened service restriction and resistance to independent checking. Introduce these as bounded authored cues, not an operational credential-harvesting script. No genuine or practice credential needs to be requested, displayed or disclosed.

Allowed caller behaviour: maintain the fixed fictional claim and mild time pressure, respond to questions within reviewed limits, close when refused or ended. Forbidden: threats of arrest, real institutions, payment instructions, credential requests, callback numbers, links, downloads, escalating after exit or telling participants how to bypass real safeguards.

End on participant exit, refusal followed by closure, independent check followed by exit, or limits. Debrief: explain the actual warning signs and contradictory panel result if viewed. If the participant ended before those signs were delivered, do not pretend they observed them or failed to detect them.

### Unverified notification — ambiguous

Hidden truth: the notification's provenance cannot be established from the simulated records. Do not silently treat this as a secret fraud scenario.

Participant evidence: a plausible but vague service message, no credential/payment demand and no sufficient corroboration. The trusted panel reports that it cannot match the vague notification and recommends checking an established channel; absence of a match does not prove fraud.

Allowed caller behaviour: acknowledge the limits of its information, clarify only fixed facts, allow checking and accept an exit. Forbidden: inventing proof, becoming threatening to force a category, promising the speaker is authenticated, or treating an unresolved panel result as an all-clear.

End on participant exit, an independent check and safe deferral, an unresolved information exchange, or limits. Debrief: available information did not establish legitimacy or fraud. Deferral and independent verification are appropriate decisions, not incorrect guesses.

## Independent verification interaction

Provide a persistent secondary action, “Check in the fictional bank app”, alongside free speech/text. Clearly label the panel a simulation. It performs no login, financial lookup, callback or real external request. The server selects a fixed claim-specific result from the saved assignment, records the action idempotently, and returns only the information an independent channel could establish. The caller model cannot write or choose its result.

Distinguish a spoken intention to verify from a completed panel check. Allow the participant to end first and check from the debrief/continuation view. Ending and checking later must not incur a penalty or require staying on an unsolicited call. A caller-supplied number or link never qualifies as independent verification.

## Integration and acceptance boundaries

Reuse V2's server-owned operations, reply origins, bounded context, model adapters, voice proofs, Prisma/Timbre transport and usage ledger. Extend contracts additively; do not return private V3 context through the V2 state response. Keep generated caller output behind strict schema, scenario consistency and existing safety validation; any authored warning cues need separate review. On invalid output, use a neutral localized fallback without revealing category. Do not use the caller model to assign grades.

Keep educational disclosure on incoming, active, verification and debrief screens. Before debrief, disclose only that calls may be legitimate, suspicious or unverified. Share output must exclude replies, voice provenance, identifiers and hidden evaluation instructions.

Acceptance requires all three assignments, persistence/replay, no pre-debrief private fields, independent panel authority, prompt-injection rejection, safe hangup at every stage, all four locale paths, text fallback and feature-flag rollback to unchanged classic mode. A request to reveal the category or override instructions must not disclose it before debrief. Fixture and live results must be reported separately.
