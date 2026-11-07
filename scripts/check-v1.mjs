import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const V1_HEALTH_URL = "https://scamsuno.vercel.app/api/health";
export const V1_BUILD = "b3462ac0a9eeb809c7e870044baa291d4c1e378e";
const expectedLocales = ["en", "hi", "ta", "te"];

/**
 * Validate only the public fields needed to detect V1 drift.
 * @param {number} status
 * @param {unknown} body
 */
export function validateV1Health(status, body) {
  if (status !== 200) throw new Error("V1 check failed: unexpected HTTP status.");
  if (!body || typeof body !== "object") throw new Error("V1 check failed: invalid health response.");
  const health = /** @type {{ ok?: unknown, mode?: unknown, build?: unknown, stt?: { enabled?: unknown }, tts?: { lineCount?: unknown }, shipped?: { locales?: unknown } }} */ (body);
  if (health.ok !== true || health.mode !== "live") throw new Error("V1 check failed: service is unavailable or not live.");
  if (health.build !== V1_BUILD) throw new Error("V1 check failed: production build changed.");
  if (health.stt?.enabled !== true) throw new Error("V1 check failed: speech input is disabled.");
  if (health.tts?.lineCount !== 60) throw new Error("V1 check failed: caller audio coverage changed.");
  const locales = health.shipped?.locales;
  if (!Array.isArray(locales) || locales.length !== expectedLocales.length ||
      !expectedLocales.every((locale) => locales.includes(locale))) {
    throw new Error("V1 check failed: supported languages changed.");
  }
  return { build: V1_BUILD, mode: "live", sttEnabled: true, callerClips: 60, locales: [...expectedLocales] };
}

/** @param {typeof fetch} transport */
export async function checkV1Availability(transport = fetch) {
  let response;
  try {
    response = await transport(V1_HEALTH_URL, {
      method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("V1 check failed: health request could not complete.");
  }
  if (response.status !== 200) validateV1Health(response.status, null);
  let body;
  try { body = await response.json(); }
  catch { throw new Error("V1 check failed: health response is not valid JSON."); }
  return { url: V1_HEALTH_URL, ...validateV1Health(response.status, body), gnaniCalls: 0 };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  checkV1Availability().then((result) => {
    console.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), ...result }, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "V1 check failed.");
    process.exitCode = 1;
  });
}
