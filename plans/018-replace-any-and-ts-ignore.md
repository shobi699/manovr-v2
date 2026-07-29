# Plan 018: Replace `any` Casts and Suppressed TS Directives in Export Helpers and Action Signatures

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- src/lib/export-helpers.ts src/app/actions/backup.ts src/app/actions/scheduled-report.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

The codebase currently contains over 600 `@typescript-eslint/no-explicit-any` ESLint warnings and suppressed TS directive comments (`// @ts-ignore` in `src/lib/export-helpers.ts:2,5`). Removing explicit `any` types in core export helpers, server action signatures, and utility functions restores strict compiler type safety and prevents runtime crashes caused by unvalidated dynamic property access.

## Current state

- `src/lib/export-helpers.ts`: Contains `// @ts-ignore` comments for `pdfmake/js/Printer` and `arabic-persian-reshaper` imports, as well as multiple parameters typed as `any` or `any[]`.
- `src/app/actions/backup.ts`, `scheduled-report.ts`, `role.ts`, `user.ts`: Contain catch blocks and action options typed as `any`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Lint      | `npm run lint`           | exit 0              |
| Tests     | `npm run test:run`       | all pass            |

## Scope

**In scope**:
- `src/lib/export-helpers.ts`
- `src/app/actions/backup.ts`
- `src/app/actions/scheduled-report.ts`
- `src/app/actions/role.ts`
- `src/app/actions/user.ts`

**Out of scope**:
- Changing public action interfaces or API contracts.

## Git workflow

- Branch: `advisor/018-replace-any-and-ts-ignore`
- Commit message: `refactor(types): replace any types and ts-ignore directives with explicit interfaces`

## Steps

### Step 1: Replace @ts-ignore with proper type declarations in export-helpers.ts
- Create or update module declarations for `pdfmake/js/Printer` and `arabic-persian-reshaper` using `// @ts-expect-error` or custom `.d.ts` declaration file in `src/types/`.
- Replace `any` parameters in `exportManeuversToExcel`, `exportManeuversToPdf`, and helper formatters with explicit interfaces (`ManovrExportItem`, `PdfTableColumn`, etc.).

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 2: Clean up any types in Server Actions (backup.ts, scheduled-report.ts, role.ts, user.ts)
- Replace `catch (err: any)` with `catch (err: unknown)` using helper function `getErrorMessage(err: unknown): string`.
- Define explicit interfaces for input payloads and options objects.

**Verify**: `npx tsc --noEmit` and `npm run test:run` -> exit 0.

## Test plan

- Run `npm run test:run` to ensure existing export-helpers tests (`export-helpers.test.ts`) pass without regressions.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] No `// @ts-ignore` comments remaining in `src/lib/export-helpers.ts`
- [ ] `npm run test:run` passes
- [ ] `plans/README.md` status row updated

## STOP conditions

- If replacing `any` with a specific interface breaks Prisma relation payloads (e.g. nested `include` shapes), create explicit helper types using `Prisma.ManovrGetPayload<{ include: { ... } }>`.
