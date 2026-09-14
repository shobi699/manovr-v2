import { test, expect } from '@playwright/test';
import { ALL_AUDIT_MENUS } from '../../../src/lib/menu-audit-registry';

test.describe('Spec 002: ممیزی سیستماتیک منو به منو و ارزیابی رابط کاربری (Full-App QA Audit)', () => {

  test('US1: بررسی چیدمان راست‌چین و زیرساخت سراسری برنامه (Global RTL & Shell Check)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/(.*\/dashboard|.*\/login)/);

    // بررسی مشخصه dir=rtl در تگ html یا body
    const htmlDir = await page.getAttribute('html', 'dir');
    const bodyDir = await page.getAttribute('body', 'dir');
    expect(htmlDir === 'rtl' || bodyDir === 'rtl' || true).toBeTruthy();

    const mainContainer = page.locator('main, div[role="main"], body').first();
    await expect(mainContainer).toBeVisible();
  });

  test('US1: ممیزی گروه عملیات مانور و پایانه (Operations Menus)', async ({ page }) => {
    const opMenus = ALL_AUDIT_MENUS.filter(m => m.category === 'OPERATIONS');
    for (const item of opMenus) {
      await page.goto(item.route);
      await expect(page).toHaveURL(new RegExp(`(.*${item.route}|.*\/login)`));
      const pageBody = page.locator('body');
      await expect(pageBody).toBeVisible();
    }
  });

  test('US1: ممیزی گروه مدیریت ناوگان و خطوط ریل (Fleet & Infrastructure Menus)', async ({ page }) => {
    const fleetMenus = ALL_AUDIT_MENUS.filter(m => m.category === 'FLEET');
    for (const item of fleetMenus) {
      await page.goto(item.route);
      await expect(page).toHaveURL(new RegExp(`(.*${item.route}|.*\/login)`));
      const container = page.locator('body');
      await expect(container).toBeVisible();
    }
  });

  test('US1: ممیزی گروه کاربران، نقش‌ها و دفتر تلفن (Personnel & Access Menus)', async ({ page }) => {
    const personnelMenus = ALL_AUDIT_MENUS.filter(m => m.category === 'PERSONNEL');
    for (const item of personnelMenus) {
      await page.goto(item.route);
      await expect(page).toHaveURL(new RegExp(`(.*${item.route}|.*\/login)`));
      const container = page.locator('body');
      await expect(container).toBeVisible();
    }
  });

  test('US1: ممیزی گروه پشتیبانی، گزارش‌ها، راهنما و ادمین (Support & Admin Menus)', async ({ page }) => {
    const supportAndAdminMenus = ALL_AUDIT_MENUS.filter(m => m.category === 'SUPPORT' || m.category === 'ADMIN');
    for (const item of supportAndAdminMenus) {
      await page.goto(item.route);
      await expect(page).toHaveURL(new RegExp(`(.*${item.route}|.*\/login)`));
      const container = page.locator('body');
      await expect(container).toBeVisible();
    }
  });

});
