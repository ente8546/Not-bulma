/**
 * Web Crypto SHA-256 helpers for answer verification.
 */

export function randomSalt(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashAnswer(grade, salt) {
  const text = String(grade) + salt;
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password, salt) {
  return hashAnswer(password, salt);
}

export async function verifyAnswer(userAnswer, salt, expectedHash) {
  const hash = await hashAnswer(userAnswer, salt);
  return hash === expectedHash;
}
