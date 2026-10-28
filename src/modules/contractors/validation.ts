/**
 * Contractors Module Validation Helpers
 * - Australian Business Number (ABN) format and checksum validation
 * - Luhn algorithm for payment card detection (rejection in text fields)
 * - Safe text formatting & phone normalization
 */

/**
 * Validates an Australian Business Number (ABN).
 * Accepts strings with or without spaces/hyphens.
 * Algorithm:
 * 1. Must be 11 numeric digits.
 * 2. Subtract 1 from first digit.
 * 3. Multiply each digit by weight: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
 * 4. Sum products and verify sum % 89 === 0.
 */
export function isValidABN(rawAbn: string | null | undefined): boolean {
  if (!rawAbn) return false;
  const cleaned = rawAbn.replace(/[\s-]/g, "");
  if (!/^\d{11}$/.test(cleaned)) {
    return false;
  }

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleaned.split("").map(Number);
  if (digits.length !== 11 || digits.some((d) => isNaN(d))) {
    return false;
  }

  // Subtract 1 from first digit
  digits[0] = digits[0]! - 1;

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i]! * weights[i]!;
  }

  return sum % 89 === 0;
}

/**
 * Normalizes an ABN into standard formatted 11 digits: XX XXX XXX XXX
 */
export function normalizeABN(rawAbn: string | null | undefined): string | null {
  if (!rawAbn) return null;
  const cleaned = rawAbn.replace(/[\s-]/g, "");
  if (cleaned.length !== 11) return rawAbn.trim();
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`;
}

/**
 * Normalizes Australian phone numbers into standardized formats.
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  // Australian Mobile: 04XX XXX XXX or +61 4XX XXX XXX
  if (digitsOnly.length === 10 && digitsOnly.startsWith("04")) {
    return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4, 7)} ${digitsOnly.slice(7, 10)}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("614")) {
    return `04${digitsOnly.slice(3, 5)} ${digitsOnly.slice(5, 8)} ${digitsOnly.slice(8, 11)}`;
  }

  // Australian Landline: (0X) XXXX XXXX or +61 X XXXX XXXX
  if (digitsOnly.length === 10 && digitsOnly.startsWith("0")) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)} ${digitsOnly.slice(6, 10)}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith("61") && !digitsOnly.startsWith("614")) {
    return `(0${digitsOnly.slice(2, 3)}) ${digitsOnly.slice(3, 7)} ${digitsOnly.slice(7, 11)}`;
  }

  return trimmed;
}

/**
 * Luhn algorithm check to detect potential payment card numbers (Credit/Debit).
 */
export function isLuhnValid(numberStr: string): boolean {
  const digits = numberStr.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Checks if a free-text field contains any credit card number passing Luhn algorithm.
 */
export function containsPaymentCard(text: string | null | undefined): boolean {
  if (!text) return false;
  const matches = text.match(/(?:\d[ -]?){13,19}/g);
  if (!matches) return false;

  for (const match of matches) {
    const cleaned = match.replace(/[\s-]/g, "");
    if (cleaned.length >= 13 && cleaned.length <= 19 && isLuhnValid(cleaned)) {
      return true;
    }
  }
  return false;
}

export const luhnCheck = isLuhnValid;
export const validateAbnChecksum = isValidABN;
export const normalizeAbn = normalizeABN;
export const normalizeAustralianPhone = normalizePhoneNumber;
