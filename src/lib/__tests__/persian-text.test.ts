import { describe, it, expect } from "vitest";
import {
  normalizePersianDigits,
  normalizePersianCharacters,
  normalizeForSearch,
  persianSearchMatch,
  generateSearchVariants,
} from "../persian-text";

describe("Persian Text & Search Normalization Utilities", () => {
  it("correctly converts Persian and Arabic digits to Latin numbers", () => {
    expect(normalizePersianDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(normalizePersianDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
    expect(normalizePersianDigits("شماره تماس: ۰۲۱-۶۶۵۴")).toBe("شماره تماس: 021-6654");
  });

  it("normalizes Arabic characters to Persian while preserving پ, گ, ژ, چ", () => {
    // ي and ك to ی and ک
    expect(normalizePersianCharacters("علي كريمي")).toBe("علی کریمی");
    // Preservation of unique Persian letters
    expect(normalizePersianCharacters("پژمان گودرزی چمران")).toBe("پژمان گودرزی چمران");
    // Alef variants
    expect(normalizePersianCharacters("آرش و أکبر و إحسان")).toBe("ارش و اکبر و احسان");
    // Tashkeel / Diacritics removal
    expect(normalizePersianCharacters("مُحَمَّد رِضا")).toBe("محمد رضا");
    // Tatweel removal
    expect(normalizePersianCharacters("مـترو تـهـران")).toBe("مترو تهران");
  });

  it("handles half-spaces and ZWNJ properly in search normalization", () => {
    const withZwnj = "محمد\u200Cرضا";
    expect(normalizeForSearch(withZwnj)).toBe("محمد رضا");
  });

  it("performs robust Persian search matching with persianSearchMatch", () => {
    // 1. Matches with Arabic vs Persian characters in both directions
    expect(persianSearchMatch("علی کریمی", "علي")).toBe(true);
    expect(persianSearchMatch("علی کریمی", "كريمي")).toBe(true);
    expect(persianSearchMatch("علي كريمي", "علی")).toBe(true);
    expect(persianSearchMatch("علي كريمي", "کریمی")).toBe(true);

    // 2. Preserves and correctly matches distinct Persian letters
    expect(persianSearchMatch("پژمان گودرزی", "پژمان")).toBe(true);
    expect(persianSearchMatch("پژمان گودرزی", "گودرزی")).toBe(true);
    expect(persianSearchMatch("بابک چاوشی", "چاوشی")).toBe(true);

    // 3. Matches with and without half-space (ZWNJ)
    expect(persianSearchMatch("محمدرضا صادقی", "محمد رضا")).toBe(true);
    expect(persianSearchMatch("محمد رضا صادقی", "محمدرضا")).toBe(true);
    expect(persianSearchMatch("محمدرضا صادقی", "محمد\u200Cرضا")).toBe(true);

    // 4. Matches with Persian digits in search query against English digits in database
    expect(persianSearchMatch("09123456789", "۰۹۱۲")).toBe(true);
    expect(persianSearchMatch("کد پرسنلی: 98104", "۹۸۱۰۴")).toBe(true);

    // 5. Multi-token search (all words match)
    expect(persianSearchMatch("علیرضا حسینی - شیفت A", "حسینی علیرضا")).toBe(true);

    // 6. Non-matching queries
    expect(persianSearchMatch("علی کریمی", "رضا")).toBe(false);
    expect(persianSearchMatch("پژمان گودرزی", "مهدی")).toBe(false);
  });

  it("generates bidirectional search variants for database querying", () => {
    // When user types Persian, Arabic variant is generated
    const variantsFromPersian = generateSearchVariants("کریمی");
    expect(variantsFromPersian).toContain("کریمی");
    expect(variantsFromPersian).toContain("كريمي");

    // When user types Arabic, Persian variant is generated
    const variantsFromArabic = generateSearchVariants("كريمي");
    expect(variantsFromArabic).toContain("کریمی");
    expect(variantsFromArabic).toContain("كريمي");

    const digitVariants = generateSearchVariants("۰۹۱۲");
    expect(digitVariants).toContain("0912");

    // Latin digits generates Persian digits
    const latinVariants = generateSearchVariants("123");
    expect(latinVariants).toContain("123");
    expect(latinVariants).toContain("۱۲۳");

    // Alef Maksura & Arabic Yeh
    const aliVariants = generateSearchVariants("علی");
    expect(aliVariants).toContain("علی");
    expect(aliVariants).toContain("علي");
    expect(aliVariants).toContain("على");

    // Teh Marbuta
    const fatemehVariants = generateSearchVariants("فاطمه");
    expect(fatemehVariants).toContain("فاطمه");
    expect(fatemehVariants).toContain("فاطمة");
  });
});
