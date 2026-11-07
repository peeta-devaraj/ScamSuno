import { createHash, timingSafeEqual } from "node:crypto";

const usernamePattern = /^[A-Za-z0-9_.-]{1,64}$/;
// Operator-generated credentials use printable ASCII without whitespace.
const passwordPattern = /^[\x21-\x7e]{24,128}$/;

function credentialDigest(username: string, password: string) {
  return createHash("sha256").update(username).update("\0").update(password).digest();
}

/** Authenticate server-side only. Never trust proxy headers to enable cleartext access. */
export function checkAdmin(request: Request): boolean {
  try {
    const url = new URL(request.url);
    const developmentLoopback = url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.VERCEL_ENV;
    if (url.protocol !== "https:" && !developmentLoopback) return false;

    const username = process.env.V2_ADMIN_USERNAME ?? "admin";
    const password = process.env.V2_ADMIN_PASSWORD;
    if (!usernamePattern.test(username) || !password || !passwordPattern.test(password)) return false;

    const header = request.headers.get("authorization");
    if (!header || Buffer.byteLength(header, "utf8") > 512) return false;
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
    if (!match || match[1].length % 4 !== 0) return false;
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.toString("base64") !== match[1]) return false;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const separator = decoded.indexOf(":");
    if (separator < 1) return false;
    // Basic permits colons inside a password; the first colon separates the username.
    const suppliedUsername = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    if (!usernamePattern.test(suppliedUsername) || !passwordPattern.test(suppliedPassword)) return false;

    return timingSafeEqual(credentialDigest(suppliedUsername, suppliedPassword), credentialDigest(username, password));
  } catch {
    return false;
  }
}

export function adminChallenge(): Response {
  return Response.json({ error: "Authentication required." }, {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="ScamSuno usage", charset="UTF-8"',
    },
  });
}
