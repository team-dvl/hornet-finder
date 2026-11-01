/**
 * The key a journal entry gets on the device (`client_key`, see
 * doc/OFFLINE.md): created once when the form opens and sent with every
 * attempt, so that an attempt whose answer was lost (timeout, dropped
 * connection) and is sent again records the entry once. The server answers a
 * replay with the entry already recorded (200 instead of 201).
 */
export function newClientKey(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Safari before 15.4: a version 4 UUID from the same random source
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Time allowed to a request carrying photos: they weigh a few hundred kB each
 * once resized, about 25 s for 1.5 MB at 0.5 Mbit/s, the upload rate of a weak
 * mobile signal. The 10 s of the other calls would cut them every time there.
 */
export const UPLOAD_TIMEOUT_MS = 60_000;
