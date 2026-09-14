/**
 * Persian & Arabic Text Normalization and Search Matching Utility
 * مخصوص سامانه Manovr V3 جهت رفع ناهماهنگی‌های حروفی (مانند ي/ی، ك/ک، پ، گ، ژ، اعراب، نیم‌فاصله‌ها و ارقام)
 */

// نگاشت ارقام فارسی و عربی به ارقام استاندارد انگلیسی
const PERSIAN_DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/**
 * تبدیل ارقام فارسی و عربی به ارقام استاندارد لاتین
 */
export function normalizePersianDigits(text?: string | null): string {
  if (!text) return "";
  return String(text)
    .replace(/[۰-۹]/g, (w) => PERSIAN_DIGITS[w] || w)
    .replace(/[٠-٩]/g, (w) => ARABIC_DIGITS[w] || w);
}

/**
 * استانداردسازی حروف عربی به معادل‌های استاندارد زبان فارسی
 * بدون حذف یا تخریب حروف خاص فارسی (پ، ژ، گ، چ، ک، ی)
 */
export function normalizePersianCharacters(text?: string | null): string {
  if (!text) return "";

  let res = String(text).normalize("NFC");

  // یکسان‌سازی اشکال مختلف ی و ك عربی به ی و ک فارسی
  res = res
    .replace(/[\u064A\u0649\u06D2]/g, "ی") // ي, ى, ے -> ی
    .replace(/[\u0643\u06AA]/g, "ک")       // ك, ڪ -> ک
    .replace(/[\u0629]/g, "ه")             // ة -> ه
    .replace(/[\u0624]/g, "و")             // ؤ -> و
    .replace(/[\u0626]/g, "ی");            // ئ -> ی

  // یکسان‌سازی اشکال مختلف الف (آ، أ، إ، ٱ) به ا برای انطباق در جستجو
  res = res.replace(/[\u0622\u0623\u0625\u0671]/g, "ا");

  // حذف حرکات و اعراب (تَنوین، فتحه، ضمه، کسره، تشدید، سکون)
  res = res.replace(/[\u064B-\u065F\u0670]/g, "");

  // حذف کشیدگی حروف (تطویل / کشیده)
  res = res.replace(/\u0640/g, "");

  // استانداردسازی نیم‌فاصله (Zero-Width Non-Joiner) و کاراکترهای مخفی به فاصله معمولی
  res = res.replace(/[\u200C\u200D\uFEFF\u00A0]/g, " ");

  return res;
}

/**
 * پاک‌سازی و نرمال‌سازی کامل رشته جهت مقایسه و فیلترینگ در موتور جستجو
 */
export function normalizeForSearch(text?: string | null): string {
  if (!text) return "";

  const digitsNormalized = normalizePersianDigits(text);
  const charsNormalized = normalizePersianCharacters(digitsNormalized);

  return charsNormalized
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * بررسی انطباق زیررشته با پشتیبانی از حروف خاص فارسی (پ، ژ، گ، ی و ...)
 * و تطبیق کلمات با/بدون فاصله یا نیم‌فاصله
 */
export function persianSearchMatch(target?: string | null, query?: string | null): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const normTarget = normalizeForSearch(target);
  const normQuery = normalizeForSearch(query);

  if (!normQuery) return true;

  // ۱. بررسی تطابق مستقیم زیررشته
  if (normTarget.includes(normQuery)) {
    return true;
  }

  // ۲. بررسی تطابق بدون فواصل (جهت پوشش نیم‌فاصله و چسبیدگی مانند "محمد رضا" و "محمدرضا")
  const compactTarget = normTarget.replace(/\s+/g, "");
  const compactQuery = normQuery.replace(/\s+/g, "");
  if (compactTarget.includes(compactQuery)) {
    return true;
  }

  // ۳. بررسی تطابق چندکلمه‌ای (Token-based): تمام واژه‌های کوئری باید در هدف وجود داشته باشند
  const tokens = normQuery.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const allTokensMatch = tokens.every((token) => normTarget.includes(token));
    if (allTokensMatch) return true;
  }

  return false;
}
const LATIN_TO_PERSIAN_DIGITS: Record<string, string> = {
  "0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴",
  "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹",
};

/**
 * تبدیل ارقام انگلیسی به ارقام فارسی
 */
export function toPersianDigits(text?: string | null): string {
  if (!text) return "";
  return String(text).replace(/[0-9]/g, (d) => LATIN_TO_PERSIAN_DIGITS[d] || d);
}

/**
 * تولید چندضلعی انواع عبارات جستجو (Persian / Arabic variants)
 * جهت ارسال به کوئری‌های OR در پایگاه‌داده Prisma (Backend Search)
 * به طوری که حتی اگر دیتابیس ی/ک/ه/الف عربی داشته باشد و کاربر فارسی بزند، یا برعکس، سرچ پیدا کند.
 */
export function generateSearchVariants(query: string): string[] {
  const q = query.trim();
  if (!q) return [];

  const variants = new Set<string>();
  variants.add(q);

  // ۱. فرم کاملاً نرمال‌شده فارسی (تبدیل ي/ك به ی/ک، ارقام انگلیسی، بدون اعراب)
  const normalizedPersian = normalizeForSearch(q);
  if (normalizedPersian) variants.add(normalizedPersian);

  // ۲. فرم نرمال‌شده حروف فارسی با حفظ ساختار رشته
  const charsNormalized = normalizePersianCharacters(normalizePersianDigits(q));
  if (charsNormalized) variants.add(charsNormalized);

  // ۳. فرم با ارقام لاتین
  const englishDigits = normalizePersianDigits(q);
  if (englishDigits) variants.add(englishDigits);

  // ۴. فرم با ارقام فارسی
  const persianDigits = toPersianDigits(englishDigits || q);
  if (persianDigits) variants.add(persianDigits);

  // ۵. فرم عربی متناظر (ی به ي و ک به ك) بر اساس فرم نرمال فارسی
  const baseForArabic = normalizedPersian || q;
  const arabicVariant = baseForArabic
    .replace(/ی/g, "ي")
    .replace(/ک/g, "ك");
  if (arabicVariant) variants.add(arabicVariant);

  // نگاشت الف مقصوره در انتهای کلمات یا کل رشته (مانند علی -> على)
  if (baseForArabic.includes("ی")) {
    const maksuraVariant = baseForArabic.replace(/ی(?=\s|$)/g, "ى");
    if (maksuraVariant !== baseForArabic) variants.add(maksuraVariant);
    const maksuraAll = baseForArabic.replace(/ی/g, "ى");
    if (maksuraAll !== baseForArabic) variants.add(maksuraAll);
  }

  // نگاشت ه به ة (تاء مربوطه) در انتهای کلمات
  if (baseForArabic.includes("ه")) {
    const tehMarbutaVariant = baseForArabic.replace(/ه(?=\s|$)/g, "ة");
    if (tehMarbutaVariant !== baseForArabic) variants.add(tehMarbutaVariant);
  }

  // نگاشت الف بدون کلاه به الف با کلاه یا همزه در ابتدای کلمه
  if (q.includes("ا")) {
    variants.add(q.replace(/(^|\s)ا/g, "$1آ"));
    variants.add(q.replace(/(^|\s)ا/g, "$1أ"));
  }

  // ۶. فرم بدون فواصل و نیم‌فاصله‌ها
  const compact = q.replace(/[\s\u200C\u200D]+/g, "");
  if (compact && compact !== q) variants.add(compact);

  return Array.from(variants).filter(Boolean);
}
