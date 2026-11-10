# ScamSuno — Can you trust this call?

**Trust or Trap** · Multilingual educational call simulator

## The problem

A fraudulent caller can sound calm, helpful and familiar. ScamSuno gives students and other digital banking users a safe place to practise questioning a claim, checking it independently and deciding when to end the call.

## How Trust or Trap works

Choose English, Tamil, Telugu or Hindi. The server assigns a fictional legitimate, fraudulent or ambiguous call and holds the answer until the debrief. Reply in your own words by typing or, when voice is available, by recording a short turn and reviewing the transcript before sending.

Open the simulated trusted app to check the notice through a separate channel. The result tells you what the notice evidence supports. The caller’s identity remains unverified. End the call to reveal the scenario and get feedback grounded in your observed choices. Untested or uncertain behaviours stay unscored.

## Gnani AI and the stack

Gnani Prisma transcribes short recordings. Gnani Timbre synthesises approved caller lines. A hosted text model selects from reviewed replies for the assigned scenario. The server validates the selection and evaluates decisions separately. Built with Next.js, React, TypeScript, Zod and a libSQL usage and session store.

## Responsible simulation

All callers, institutions and notices are fictional. Use fictional details in replies. The app handles audio in memory and sends recordings to Gnani for transcription. The V3 source omits participant reply text from new session records, filters replies sent to the text model and limits provider access with a durable usage ledger.

## What the demo shows

The 2:05 video shows two offline typed cases and explains the voice architecture. A separate bounded English API smoke exercised live Prisma and Timbre with synthetic input. Physical Android microphone acceptance in Tamil and Telugu remains pending. Live access depends on the configured allowance.

## Project

[Open the public Trust or Trap entry](https://scamsuno.vercel.app/) · The 2:05 video is linked separately in the submission.
