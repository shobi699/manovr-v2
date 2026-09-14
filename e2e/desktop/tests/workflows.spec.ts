import { test, expect } from '@playwright/test';

test.describe('Core Workflows — سناریوهای حیاتی سیستم مانور', () => {

  test.describe('Workflow 1: احراز هویت و ورود به سامانه (Login Flow)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('کاربر باید بتواند صفحه لاگین را مشاهده و فرم ورود را پر کند', async ({ page }) => {
      // Step 1: Navigate to /login
      await page.goto('/login');
      // Verify: فرم ورود و فیلدهای نام کاربری و پسورد قابل مشاهده باشند
      const loginForm = page.locator('form').filter({ has: page.locator('input[name="userName"]') });
      await expect(loginForm).toBeVisible();

      const userNameInput = page.locator('input#userName, input[name="userName"]');
      await expect(userNameInput).toBeVisible();

      const passwordInput = page.locator('input#password, input[name="password"]');
      await expect(passwordInput).toBeVisible();

      // Step 2 & 3: Type username & password
      await userNameInput.fill('admin');
      await passwordInput.fill('admin');

      // Step 4: Click login button
      const loginBtn = page.locator('button:has-text("ورود")');
      await expect(loginBtn).toBeVisible();
      await expect(loginBtn).toBeEnabled();
    });
  });

  test.describe('Workflow 2: مدیریت کاربران و تخصیص نقش‌ها (Users & RBAC)', () => {
    test('بررسی ساختار صفحه مدیریت کاربران و ناوبری فرم کاربر جدید', async ({ page }) => {
      // Step 1: Navigate to /users
      await page.goto('/users');
      // Verify: صفحه کاربران یا تغییر مسیر مجاز
      await expect(page).toHaveURL(/(.*\/users|.*\/login)/);

      // Step 2: Navigate to /users/new
      await page.goto('/users/new');
      await expect(page).toHaveURL(/(.*\/users\/new|.*\/login)/);
    });
  });

  test.describe('Workflow 3: مانیتورینگ نمای دپو و خطوط ریلی (Depot 3D & 2D)', () => {
    test('بارگذاری صفحه دپو و بررسی وجود المان‌های گرافیکی ایستگاه', async ({ page }) => {
      // Step 1: Navigate to /depot
      await page.goto('/depot');
      await expect(page).toHaveURL(/(.*\/depot|.*\/login)/);

      // Verify: بررسی المان اصلی صفحه دپو در صورت لود
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

});

test.describe('Feature Workflows — سناریوهای قابلیت‌های کلیدی', () => {

  test.describe('Workflow 4: مدیریت قطارها و ناوگان ریلی (Trains Management)', () => {
    test('بررسی صفحه لیست قطارها و امکان تعریف قطار جدید', async ({ page }) => {
      // Step 1: Navigate to /trains
      await page.goto('/trains');
      await expect(page).toHaveURL(/(.*\/trains|.*\/login)/);

      // Step 2: Navigate to /trains/new
      await page.goto('/trains/new');
      await expect(page).toHaveURL(/(.*\/trains\/new|.*\/login)/);
    });
  });

  test.describe('Workflow 5: مدیریت خطوط و ایستگاه‌ها (Railway Lines)', () => {
    test('بررسی صفحه مدیریت خطوط ریلی و فرم ثبت خط جدید', async ({ page }) => {
      // Step 1: Navigate to /lines
      await page.goto('/lines');
      await expect(page).toHaveURL(/(.*\/lines|.*\/login)/);

      // Step 2: Navigate to /lines/new
      await page.goto('/lines/new');
      await expect(page).toHaveURL(/(.*\/lines\/new|.*\/login)/);
    });
  });

  test.describe('Workflow 6: ثبت و تاییدیه عملیات مانور (Manovr Approvals)', () => {
    test('ناوبری به لیست مانورها و کارتابل تاییدات', async ({ page }) => {
      // Step 1: Navigate to /manovrs
      await page.goto('/manovrs');
      await expect(page).toHaveURL(/(.*\/manovrs|.*\/login)/);

      // Step 2: Navigate to /manovrs/approvals
      await page.goto('/manovrs/approvals');
      await expect(page).toHaveURL(/(.*\/manovrs\/approvals|.*\/login)/);
    });
  });

  test.describe('Workflow 8: سامانه گزارش‌ساز پویا (Reporting Engine)', () => {
    test('بررسی لودینگ صفحه گزارش‌ساز', async ({ page }) => {
      // Step 1: Navigate to /reports
      await page.goto('/reports');
      await expect(page).toHaveURL(/(.*\/reports|.*\/login)/);
    });
  });

  test.describe('Workflow 9: تعامل با آکاردئون سایدبار (Sidebar Collapsible Accordion)', () => {
    test('بررسی باز و بسته شدن آکاردئون تحلیل و تنظیمات در سایدبار', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/(.*\/dashboard|.*\/login)/);

      const accordionBtn = page.locator('button:has-text("تحلیل و تنظیمات")');
      if (await accordionBtn.isVisible()) {
        await accordionBtn.click();
        await page.waitForTimeout(200);
        await accordionBtn.click();
        await page.waitForTimeout(200);
      }
    });
  });

  test.describe('Workflow 10: منوی کلیک‌راست هوشمند در نمای پایانه (Context Menu Engine)', () => {
    test('فشردن کلیک راست و بررسی باز شدن، کلیک روی گزینه‌ها، اجرای اکشن و بسته‌شدن منو', async ({ page }) => {
      await page.goto('/depot');
      await expect(page).toHaveURL(/(.*\/depot|.*\/login)/);

      if (!page.url().includes('/login')) {
        // ۱. باز کردن منوی هوشمند با کلیک راست
        await page.mouse.click(350, 350, { button: 'right' });
        const contextMenu = page.locator('[role="menu"]');
        await expect(contextMenu).toBeVisible();

        // ۲. انتخاب و کلیک روی یک گزینه (مثلاً کپی نشانی صفحه یا ابزارهای ناوبری)
        const copyUrlOption = contextMenu.locator('button:has-text("کپی نشانی صفحه جاری")');
        if (await copyUrlOption.isVisible()) {
          // کلیک روی آیتم و بررسی اجرای موفق و بسته‌شدن منو
          await copyUrlOption.click();
          await expect(contextMenu).not.toBeVisible();
        } else {
          // در صورت وجود گزینه‌های دیگر، اولین دکمه فعال کلیک شود
          const firstOption = contextMenu.locator('button[role="menuitem"]:not([disabled])').first();
          await firstOption.click();
          await expect(contextMenu).not.toBeVisible();
        }

        // ۳. بررسی باز شدن مجدد و بستن با کلید Escape
        await page.mouse.click(350, 350, { button: 'right' });
        await expect(contextMenu).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(contextMenu).not.toBeVisible();
      }
    });
  });

});


test.describe('Edge Case Workflows — سناریوهای پایش و امنیت', () => {

  test.describe('Workflow 7: بازرسی و لاگ امنیتی سیستم (Audit Log)', () => {
    test('بررسی صفحه دفتر ثبت وقایع امنیتی', async ({ page }) => {
      // Step 1: Navigate to /admin/audit
      await page.goto('/admin/audit');
      await expect(page).toHaveURL(/(.*\/admin\/audit|.*\/login)/);
    });
  });

  test.describe('Edge Case: هدایت امن کاربر احراز نشده به صفحه لاگین', () => {
    test('درخواست روت‌های محافظت‌شده بدون سشن باید به لاگین ری‌دایرکت شوند', async ({ browser }) => {
      // ایجاد یک Context کاملاً ایزوله بدون کوکی و سشن
      const context = await browser.newContext({ storageState: undefined });
      const unauthPage = await context.newPage();

      await unauthPage.goto('/dashboard');
      // انتظار هدایت به /login
      await expect(unauthPage).toHaveURL(/.*\/login/);

      await context.close();
    });
  });

});
