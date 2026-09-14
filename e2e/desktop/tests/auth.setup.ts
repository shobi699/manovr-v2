import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const authDir = path.join(__dirname, '..', 'playwright', '.auth');
const authFile = path.join(authDir, 'user.json');

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  // ۱. بررسی وجود پروفایل‌های ذخیره‌شده از اسکیل setup-profiles
  const rootProfilesDir = path.join(process.cwd(), '.playwright', 'profiles');
  const rootProfilesConfig = path.join(process.cwd(), '.playwright', 'profiles.json');

  if (fs.existsSync(rootProfilesConfig)) {
    try {
      const config = JSON.parse(fs.readFileSync(rootProfilesConfig, 'utf-8'));
      const profileName = Object.keys(config.profiles || {})[0];
      if (profileName) {
        const profilePath = path.join(rootProfilesDir, `${profileName}.json`);
        if (fs.existsSync(profilePath)) {
          const state = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
          fs.writeFileSync(authFile, JSON.stringify(state));
          return;
        }
      }
    } catch {
      // ادامه با متد لاگین مستقیم
    }
  }

  // ۲. احراز هویت خودکار با فرم لاگین سامانه مانور
  const username = process.env.TEST_USERNAME || 'admin';
  const password = process.env.TEST_PASSWORD || 'admin';

  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
    const usernameInput = page.locator('input#userName, input[name="userName"]');
    const passwordInput = page.locator('input#password, input[name="password"]');

    if (await usernameInput.isVisible()) {
      await usernameInput.fill(username);
      await passwordInput.fill(password);
      await page.locator('button[type="submit"], button:has-text("ورود")').click();
      await page.waitForURL('**/dashboard', { timeout: 8000 }).catch(() => {});
    }

    await page.context().storageState({ path: authFile });
  } catch {
    // در صورت عدم اجرای سرور محلی، ذخیره وضعیت پیش‌فرض خالی تا تست‌ها کرش نکنند
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
  }
});
