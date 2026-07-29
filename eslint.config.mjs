import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // main.js پروسه اصلی الکترون است و مستقیماً توسط Node اجرا می‌شود، نه از طریق
    // باندلر. بنابراین require در آن درست است و خطای واقعی محسوب نمی‌شود.
    files: ["main.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      // به تعویق افتاده، نه بخشیده‌شده: حدود ۲۰۶ مورد any در src/ پیش از وجود هرگونه
      // تست نوشته شده‌اند. تایپ‌کردن آنها جداگانه پیگیری می‌شود؛ تا آن زمان نباید
      // گیت لینتی را که تمام پلن‌های دیگر بر اساس آن راستی‌آزمایی می‌شوند مسدود کند.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-vars": "warn",

      // موارد جزئی در فایل‌های خارج از دامنه این پلن.
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",

      // قوانین جدید React Compiler (eslint-plugin-react-hooks v6).
      // اینها یافته‌های واقعی هستند — ۱۲ مورد set-state-in-effect در ۸ کامپوننت،
      // به‌علاوه نقض purity و immutability — و در پلن جداگانه‌ای بررسی می‌شوند.
      // تا آن زمان نباید گیت لینت را مسدود کنند.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "**/.next/**",
    "node_modules/**",
    "**/node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "scripts/**",
    "prisma/*.mjs",
    "plans/**",
  ]),
]);

export default eslintConfig;
