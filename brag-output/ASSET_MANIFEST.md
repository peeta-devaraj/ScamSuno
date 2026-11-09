# ScamSuno demo asset manifest

| Timeline | Asset | Evidence class | Provenance / replacement |
| --- | --- | --- | --- |
| 00:00–00:05 | Incoming-call illustration and waveform | Illustrative | Original composition artwork. SVG icon paths from ScamSuno. No caller audio. |
| 00:05–00:10 | `composition/assets/v3-entry.mp4` | Authentic public app capture | Signed-out [Trust or Trap](https://scamsuno.vercel.app) in desktop Chrome at a mobile viewport. Real locale clicks in English, Tamil and Telugu. No call started; capture blocked API routes and external requests. `v3-entry-raw.webm` is the original, and `v3-entry-en.png` is a still from that capture. |
| 00:10–00:36 | Live voice recording slot | Phone footage pending | Silent illustration of record, confirm and listen. The live synthetic English provider check is documented separately and is neither heard nor depicted. Replace with one accepted Android Chrome Tamil or Telugu exchange. |
| 00:36–00:45 | Trusted-channel diagram | Illustrative, real footage pending | Explains the notice/caller distinction. Replace with the same call's actual End and independent check. |
| 00:45–00:52 | Evidence review rubric | Illustrative, real footage pending | Rubric labels explain product behaviour. No participant decision, score or observed outcome is shown. Replace with the same call's debrief. |
| 00:52–00:56 | Scenario category cards | Illustrative | Legitimate, fraudulent and ambiguous categories are documented in the V3 app. |
| 00:56–01:00 | Branded closing frame | Illustrative with verified destination | ScamSuno logo, tagline and the signed-out-verified public V3 address, `scamsuno.vercel.app`. |
| 00:00–00:10 and 00:36–01:00 | `composition/assets/draft-score.wav` | Original illustrative music | Synthesized locally by the included `make-score.py`. Contains only instrumental notes. The voice slot is silent. |
| Frame 0 | `scamsuno-v3-thumbnail.jpg` | Illustrative | Branded hook from the edit. |

The composition also includes a pinned GSAP library for offline timeline playback. The draft contains no provider speech, transcripts, scoring evidence, or mock voice footage. See the [public entry capture record](../docs/audit/evidence/video-live/entry-capture.json) and [separate English provider smoke](../docs/release/PUBLIC_VOICE_ROLLOUT.md).


GSAP 3.13.0 is vendored from the npm distribution of [GreenSock/GSAP](https://github.com/greensock/GSAP). Its header and [standard license](https://gsap.com/standard-license/) apply to that library.
