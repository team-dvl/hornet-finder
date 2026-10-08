/**
 * AFSCA (FAVV) registration numbers of the apiaries: 10 digits written
 * `X.XXX.XXX.XXX` (e.g. `9.005.577.599`). Same rules as `backend/hornet/afsca.py`.
 */

export const AFSCA_DIGITS = 10;
export const AFSCA_EXAMPLE = '9.005.577.599';

/** Group sizes of a number: 9 · 005 · 577 · 599 */
const GROUPS = [1, 3, 3, 3];

/** The digits of a typed number, at most 10 */
export const afscaDigits = (value: string) => value.replace(/\D/g, '').slice(0, AFSCA_DIGITS);

/** Dots inserted as the digits come: `90055` -> `9.005.5` */
export function formatAfscaPartial(value: string): string {
  const digits = afscaDigits(value);
  const parts: string[] = [];
  let start = 0;
  for (const size of GROUPS) {
    if (start >= digits.length) break;
    parts.push(digits.slice(start, start + size));
    start += size;
  }
  return parts.join('.');
}

/** True for `''` (no number) or a complete number */
export const isValidAfsca = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return value.trim() === '' || (digits.length === AFSCA_DIGITS && /^[\d\s./-]*$/.test(value.trim()));
};

/** A number as displayed: `X.XXX.XXX.XXX`, or unchanged if it is not a 10-digit number (older data) */
export function formatAfsca(value: string): string {
  return isValidAfsca(value) && value.trim() !== '' ? formatAfscaPartial(value) : value;
}

/** True when a form may send this value (empty, complete, or the untouched older value) */
export const afscaInputIsValid = (value: string, initialValue = '') =>
  value === initialValue || isValidAfsca(value);
