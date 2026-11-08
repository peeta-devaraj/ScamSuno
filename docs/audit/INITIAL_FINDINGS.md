# Initial findings — provisional

Scope: source inspection at 9bb000b and saved offline evidence. This is not a live-deployment certification.

- F01: README line 5 sends users to V1. User screenshots show canonical V1 with the exact legacy classifier-unavailable message. V3 free-form testing cannot be inferred from those screenshots. Investigate navigation and mode labels.
- F02: Playwright configuration uses fake capture audio, mock Gnani and a desktop Chrome profile at a mobile viewport. Reported browser passes do not establish phone microphone, native-language accuracy or live V3 voice reliability.
- F03: V3 conversational progression serially depends on an evaluator request before caller generation; evaluator failure returns unchanged state (`src/server/v3/conversation.ts:18-20`). Investigate failure UX and deadline fit.
- F04: Caller prompt forbids even benign credential vocabulary and the Hindi article एक (`src/server/v3/caller.ts:13-18`). Documentation reports article-triggered fallback. Investigate whether constraints materially undermine natural conversation.
- Positive evidence: public state uses an explicit allowlist; caller category is assigned server-side; evaluation excludes hidden category; saved 17 offline checks cover refusal/quotation safeguards and explicit credential redaction. These are narrow assurances, not a full security assessment.

No production, database or provider mutation was performed. Specialist attempts returned no findings due to usage limits.

## Resumed investigation: independently reproduced

- F05 (high): `attachCaller` accepts “There is no service update in the app.” for routine_update, although permitted facts and trusted verification say the update exists. Synthetic candidate injection, not an observed live model output. See audit-probes.log; controller.ts:115-135 and scenarios.ts:30-35.
- F06 (high): “The password I use is synthetic-mango-test-only.” reaches the outbound caller payload unchanged. Explicit syntactic patterns miss this ordinary paraphrase. No actual password was used and no provider request occurred. privacy.ts:8-23; caller.ts:36-49.
- F03 reproduced: evaluator exception produces evaluation_unavailable at turn zero; caller is never invoked. This is conservative scoring but a conversation availability dependency.
- Immediate hang-up across all three categories grants only exit_safely; other dimensions remain not_tested. No evidence of blanket refusal earning a full success result.
- 80 selected critical tests passed, zero failed, duration 38345.2787 ms. See session2-critical-tests.log. No live API or physical-device testing occurred.
- Credit enforcement counts requests; verifiedCreditFloor is compared with reserveCredits but no charged-credit decrement is computed (ledger.ts:135-137,190-199). Thus request ceilings are supported; a continuing account-wide credit reserve is not guaranteed.
- No transcript/session purge implementation was found by targeted search in src/app/scripts. Eight-minute call expiry is not a retention policy; verify external operational cleanup before treating this as indefinite retention in production.

Audit harness initially failed to parse due to a missing closing brace; corrected before obtaining the above results. This was an audit-script error, not an application defect. Initial error log retained.
