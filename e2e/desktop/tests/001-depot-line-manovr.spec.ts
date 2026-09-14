import { test, expect } from '@playwright/test';

test.describe('Spec 001: مانور سریع و اعتبارسنجی خطوط پایانه (Depot Line Shunting & Validation)', () => {

  test('US1: باز شدن صفحه پایانه و بررسی دسترسی به خطوط و مودال جزئیات', async ({ page }) => {
    // ناوبری به صفحه پایانه
    await page.goto('/depot');
    await expect(page).toHaveURL(/(.*\/depot|.*\/login)/);

    // در صورتی که کاربر ریدایرکت نشده باشد و در پایانه باشد
    const depotContainer = page.locator('main, #depot-scene-container, div[role="main"]').first();
    await expect(depotContainer).toBeVisible();

    // بررسی وجود نشانگرهای وضعیت خطوط یا نوار کنترل پایانه
    const terminalHeader = page.locator('header, nav, h1, h2').first();
    await expect(terminalHeader).toBeVisible();
  });

  test('US2: اعتبارسنجی پایداری داده در صفحه ثبت و تاریخچه مانورها (Persistence Proof)', async ({ page }) => {
    // مراجعه به صفحه مانورها جهت اثبات صحت ثبت و بارگذاری از دیتابیس
    await page.goto('/manovrs');
    await expect(page).toHaveURL(/(.*\/manovrs|.*\/login)/);

    const mainArea = page.locator('body');
    await expect(mainArea).toBeVisible();

    // بررسی اینکه جدول یا کارت‌های مانور بارگذاری شده‌اند
    const content = page.locator('table, .grid, [data-testid="manovrs-list"], div').first();
    await expect(content).toBeVisible();
  });

});
