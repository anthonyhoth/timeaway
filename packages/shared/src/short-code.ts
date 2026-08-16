/**
 * Public trip share code for gettimeaway.com/t/<code>. 32-character alphabet
 * (no 0/O/1/l/I ambiguity) so 256 % 32 === 0 keeps the modulo unbiased;
 * 32^8 ≈ 1.1e12 codes. Uniqueness is enforced by the DB constraint — callers
 * retry on collision.
 */
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function generateShortCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length]!;
  return code;
}
