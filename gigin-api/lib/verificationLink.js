// Continue URL for the verification link. The page origin is not used:
// Firebase rejects a continue URL whose host is not an authorised domain,
// which is what the first send was passing through from the browser.
export function verificationContinueUrl(env = process.env) {
  const base = String(env.BASE_URL || "https://giginmusic.com").replace(/\/$/, "");
  return `${base}/`;
}
