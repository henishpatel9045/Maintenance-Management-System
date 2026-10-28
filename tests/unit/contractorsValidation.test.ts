import { describe, it, expect } from "vitest";
import {
  isValidABN,
  normalizeABN,
  normalizeAustralianPhone,
  containsPaymentCard,
  luhnCheck,
} from "../../src/modules/contractors/validation";
import { neutralizeFormula } from "../../src/core/export/csv";

describe("Contractors Validation: ABN, Phone, Luhn & Formula Neutralization", () => {
  describe("ABN Validation & Checksum", () => {
    // Known valid Australian ABNs
    const validABNs = [
      "51 824 753 556", // ATO
      "53 004 085 616", // Telstra
      "48 123 123 124", // Commonwealth Bank
      "28 864 970 579", // Australia Post
    ];

    it("accepts valid Australian ABNs with or without spacing", () => {
      for (const abn of validABNs) {
        expect(isValidABN(abn)).toBe(true);
        expect(isValidABN(abn.replace(/\s+/g, ""))).toBe(true);
      }
    });

    it("rejects invalid ABNs", () => {
      expect(isValidABN("12 345 678 901")).toBe(false); // bad checksum
      expect(isValidABN("00 000 000 000")).toBe(false); // all zeroes
      expect(isValidABN("5182475355")).toBe(false); // 10 digits (too short)
      expect(isValidABN("518247535560")).toBe(false); // 12 digits (too long)
      expect(isValidABN("51 824 753 55A")).toBe(false); // alphanumeric
      expect(isValidABN("")).toBe(false);
    });

    it("normalizes ABN by formatting into standard Australian XX XXX XXX XXX grouping", () => {
      expect(normalizeABN("51-824-753-556")).toBe("51 824 753 556");
      expect(normalizeABN("53004085616")).toBe("53 004 085 616");
    });
  });

  describe("Australian Phone Normalization", () => {
    it("normalizes various Australian phone formats to standard format", () => {
      expect(normalizeAustralianPhone("0412345678")).toBe("0412 345 678");
      expect(normalizeAustralianPhone("+61412345678")).toBe("0412 345 678");
      expect(normalizeAustralianPhone("0412 345 678")).toBe("0412 345 678");
      expect(normalizeAustralianPhone("(02) 9876 5432")).toBe("(02) 9876 5432");
      expect(normalizeAustralianPhone("0298765432")).toBe("(02) 9876 5432");
      expect(normalizeAustralianPhone("+61298765432")).toBe("(02) 9876 5432");
    });

    it("leaves international or non-standard formats cleanly trimmed", () => {
      expect(normalizeAustralianPhone("  +1 555 123 4567  ")).toBe("+1 555 123 4567");
    });
  });

  describe("Luhn Credit Card Detection", () => {
    it("accurately validates numbers with Luhn check", () => {
      // Known valid 16-digit test card number (Luhn sum = 30)
      expect(luhnCheck("4532015000000007")).toBe(true);
      expect(luhnCheck("4532015000000008")).toBe(false);
    });

    it("detects and rejects card-like numbers in free-text fields", () => {
      expect(containsPaymentCard("Please charge card 4532 0150 0000 0007 for call-out fee")).toBe(true);
      expect(containsPaymentCard("Account note: 4532-0150-0000-0007")).toBe(true);
      expect(containsPaymentCard("Routine maintenance on level 2. Contact John.")).toBe(false);
    });

    it("does not false-positive on valid Australian ABNs or phone numbers", () => {
      expect(containsPaymentCard("ABN: 51 824 753 556")).toBe(false);
      expect(containsPaymentCard("Office phone: (02) 9876 5432, Mobile: 0412 345 678")).toBe(false);
    });
  });

  describe("Formula Injection Neutralization", () => {
    it("prefixes dangerous formula trigger characters with an apostrophe", () => {
      expect(neutralizeFormula("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
      expect(neutralizeFormula("+1+2")).toBe("'+1+2");
      expect(neutralizeFormula("-100")).toBe("'-100");
      expect(neutralizeFormula("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
      expect(neutralizeFormula("\tTabDelimited")).toBe("'\tTabDelimited");
      expect(neutralizeFormula("\rCarriageReturn")).toBe("'\rCarriageReturn");
    });

    it("leaves safe text unchanged", () => {
      expect(neutralizeFormula("Apex Electrical Pty Ltd")).toBe("Apex Electrical Pty Ltd");
      expect(neutralizeFormula("Standard rate: $120.00")).toBe("Standard rate: $120.00");
      expect(neutralizeFormula(12345)).toBe(12345);
      expect(neutralizeFormula(null)).toBe(null);
    });
  });
});
