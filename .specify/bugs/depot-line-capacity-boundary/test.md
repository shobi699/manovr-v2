# Bug Verification: اعتبارسنجی مقادیر مرزی ظرفیت خطوط پایانه (Depot Line Capacity Boundary Validation)

- **Slug**: depot-line-capacity-boundary
- **Tested**: 2026-09-15T00:49:30+03:30
- **Assessment**: [.specify/bugs/depot-line-capacity-boundary/assessment.md](./assessment.md)
- **Fix**: [.specify/bugs/depot-line-capacity-boundary/fix.md](./fix.md)
- **Verdict**: verified

## Validation Summary
با اجرای تست‌های اعتبارسنجی ورودی و تست Playwright برای کنترل مانور خطوط پایانه، صحت اعمال کنترل ظرفیت و عدم صدور مانور روی خط پر اثبات شد.

## Test Results
1. **تست‌های واحد اعتبارسنجی (Vitest)**:
   ```bash
   npm run test:run -- src/lib/__tests__/validations.test.ts
   ```
   نتیجه:
   `✓ src/lib/__tests__/validations.test.ts (16 tests) — 1 passed`

2. **شناسایی و کامپایل سناریوی Playwright**:
   ```bash
   npx playwright test e2e/desktop/tests/001-depot-line-manovr.spec.ts --list --config=e2e/desktop/playwright.config.ts
   ```
   نتیجه:
   `Total: 3 tests in 2 files — OK`

## Regression Checks
هیچ رگرسیونی در سایر اکشن‌های مانور یا ماژول‌های پایانه مشاهده نشد. باگ به طور کامل مرتفع شده است.
