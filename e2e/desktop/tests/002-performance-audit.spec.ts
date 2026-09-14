import { test, expect } from '@playwright/test';

test.describe('Spec 002: سنجش سبکی و کارایی عملکردی منوها (Performance & Lightness Audit)', () => {

  test('US3: سنجش زمان بارگذاری منوهای کلیدی (Load Latency Thresholds)', async ({ page }) => {
    const criticalRoutes = [
      { route: '/depot', maxAllowedMs: 3000 },
      { route: '/dashboard', maxAllowedMs: 2500 },
      { route: '/manovrs', maxAllowedMs: 2500 },
      { route: '/trains', maxAllowedMs: 2500 },
      { route: '/reports', maxAllowedMs: 2500 },
    ];

    for (const item of criticalRoutes) {
      const startTime = Date.now();
      await page.goto(item.route);
      const elapsedMs = Date.now() - startTime;

      // اثبات لود و سبکی صفحه
      await expect(page.locator('body')).toBeVisible();
      expect(elapsedMs).toBeLessThanOrEqual(item.maxAllowedMs);
    }
  });

  test('US3: ارزیابی روانی و عدم فریز در تعویض مسیرها (Route Transition Smoothness)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();

    const switchStart = Date.now();
    await page.goto('/lines');
    await expect(page.locator('body')).toBeVisible();
    const switchElapsed = Date.now() - switchStart;

    // تعویض سریع منو بدون توقف رویدادها
    expect(switchElapsed).toBeLessThan(3000);
  });

});
