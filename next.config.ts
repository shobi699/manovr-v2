import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // خروجی standalone نباید شامل سورس، فایل‌های محیطی، پشتیبان‌ها و
  // خروجی بیلدهای قبلی باشد. بدون این محدودیت‌ها، فایل‌تریسر کل پوشه‌ی پروژه
  // را کپی می‌کند و نصب‌کننده‌ی الکترون همه‌ی آن را بسته‌بندی می‌کند.
  outputFileTracingExcludes: {
    "*": [
      "**/ManovrSystem*",
      "**/*.exe",
      "**/*.rar",
      "**/*.zip",
      "**/.env*",
      "**/backups/**",
      "**/seed/**",
      "**/src/**",
      "**/scripts/**",
      "**/plans/**",
      "**/.agents/**",
      "**/.claude/**",
      "**/*.tsbuildinfo",
      "**/graphify-out/**",
    ],
  },
};

export default nextConfig;
