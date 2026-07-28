# Plan 001: Establish a verification baseline — Vitest unit tests plus a lint command that exits 0

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: Do NOT use `git diff` for this. This repository
> has exactly one commit (`3ec213d`, "Initial commit from Create Next App")
> and essentially the entire application lives in uncommitted working-tree
> state, so a diff against HEAD is meaningless noise. Instead: open each file
> quoted under "Current state" and confirm the quoted lines still match. On any
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

This repository has no automated verification of any kind. There are no test
files anywhere under `src/`, `package.json` has no test script, and
`npx eslint .` currently exits non-zero with 267 errors. The only command that
passes today is `npx tsc --noEmit`.

That means nobody — human or agent — can change the authentication, reporting,
or scheduling logic and know whether they broke something. Eleven other plans
in `plans/` depend on this one, because each of them ends with "run the tests"
and there is currently nothing to run.

This plan does two separable things: it adds a real test runner with seed tests
over the pure logic in `src/lib/`, and it makes `npm run lint` a command that
can actually be used as a gate. It deliberately does **not** try to type the
206 `any` sites in the codebase — that is a separate, much larger job, and
conflating the two is how this plan fails.

## Current state

Files you will touch:

- `package.json` — no test script; `lint` is bare `eslint`
- `eslint.config.mjs` — extends `eslint-config-next`, no rule overrides
- `tsconfig.json` — defines the `@/*` path alias the tests will need
- `src/lib/perms.ts`, `src/lib/report-engine.ts`, `src/lib/audit.ts`,
  `src/lib/scheduler.ts`, `src/lib/export-helpers.ts` — the pure functions to test

### `package.json:1-12` as it exists today

```json
{
  "name": "manovr-v2",
  "version": "0.1.0",
  "private": true,
  "main": "main.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "build:electron": "node scripts/build.js"
  },
```

### `eslint.config.mjs` in full, as it exists today

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

### `tsconfig.json:19-21` — the path alias tests must resolve

```json
    "paths": {
      "@/*": ["./src/*"]
    }
```

### The current lint failure, measured

`npx eslint .` reports `316 problems (267 errors, 49 warnings)`. The
overwhelming majority are `@typescript-eslint/no-explicit-any`
(206 `any` / `as any` / `@ts-ignore` sites across `src/`), plus a handful of
`@typescript-eslint/ban-ts-comment` in `src/lib/export-helpers.ts:2` and `:5`.

### The functions to test — all pure, no database access

**`src/lib/perms.ts:100-128`**

```ts
export function permsInclude(perms: string[], perm: Perm) {
  return perms.includes(perm);
}

// چک مجوز برای server action ها
export async function hasPerm(session: Session | null, perm: Perm): Promise<boolean> {
  if (!session) return false;
  const perms = await getUserPerms(session.id, session.role);
  return perms.includes(perm);
}

/**
 * دریافت سطح قدرت نقش‌ها برای کنترل سلسله مراتب (Hierarchy)
 */
export function getRoleLevel(role: number): number {
  if (role === 4) return 100; // Super Admin (سوپرادمین)
  if (role === 1) return 80;  // Admin (مدیر/ادمین)
  if (role === 2) return 50;  // Operator (مسئول شیفت/مسئول)
  if (role === 3) return 30;  // Viewer (مشاهده)
  return 0;                   // Guest / No Access (بدون دسترسی)
}

export function isRoleAllowedToManage(actorRole: number, targetRole: number): boolean {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}
```

Note: `getRoleLevel` maps role `1` (Admin) to 80 and role `4` (Super Admin) to
100. Role `0` and any unknown role fall through to 0. `isRoleAllowedToManage`
is strictly greater-than, so an actor cannot manage a peer at the same level.

**`src/lib/audit.ts:6-27`** — `computeDiff`. Note the `ignoreKeys` list: this is
the function that keeps `passwordHash` out of the audit table, and plan 003
relies on that behaviour holding.

```ts
export function computeDiff(before: any, after: any) {
  const diff: Record<string, { old: any; new: any }> = {};

  const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));

  const ignoreKeys = ["createdAt", "updatedAt", "passwordHash", "id"];

  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;
    // بررسی فیلدهای رابطه‌ای (آبجکت‌ها یا آرایه‌ها)
    if (typeof before?.[key] === "object" || typeof after?.[key] === "object") continue;

    const oldVal = before?.[key];
    const newVal = after?.[key];

    if (oldVal !== newVal) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return diff;
}
```

**`src/lib/scheduler.ts:16-60`** — `matchCronField` (module-private) and
`cronMatch` (exported). Only `cronMatch` is exported, so test through it.

```ts
function matchCronField(cronField: string, currentVal: number): boolean {
  if (cronField === "*") return true;
  if (cronField.startsWith("*/")) {
    const step = parseInt(cronField.slice(2));
    return currentVal % step === 0;
  }
  if (cronField.includes(",")) {
    const parts = cronField.split(",").map((p) => parseInt(p));
    return parts.includes(currentVal);
  }
  if (cronField.includes("-")) {
    const [start, end] = cronField.split("-").map((p) => parseInt(p));
    return currentVal >= start && currentVal <= end;
  }
  return parseInt(cronField) === currentVal;
}

export function cronMatch(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [minPattern, hourPattern, dayPattern, monthPattern, dayOfWeekPattern] = parts;
  // تبدیل تاریخ به منطقه زمانی تهران
  const tehranTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
  const min = tehranTime.getMinutes();
  const hour = tehranTime.getHours();
  const day = tehranTime.getDate();
  const month = tehranTime.getMonth() + 1; // 1-12
  const dayOfWeek = tehranTime.getDay();
  return (
    matchCronField(minPattern, min) &&
    matchCronField(hourPattern, hour) &&
    ...
  );
}
```

**IMPORTANT — `src/lib/scheduler.ts` imports Prisma at module scope**
(`import { prisma } from "@/lib/prisma";` at line 4) and also imports
`export-helpers`, which loads `pdfmake` and `exceljs`. Importing `cronMatch`
directly from `scheduler.ts` in a test will pull all of that in. See Step 4 for
how to handle this.

**`src/lib/report-engine.ts:33-137`** — `buildPrismaWhere(entity, filters)`.
Pure: it only builds a plain object, no database call. Key behaviours to cover:

- Numeric coercion for the field list at line 42 (`id`, `capacity`, `terminal`,
  `type`, `status`, `role`, `shift`, `orgPosition`, `trainId`, `sourceLineId`,
  `destinationLineId`, `rahbar1Id`, `confirmationStatus`)
- Boolean coercion at line 44 (`isDynamic`, `isDisposed`, `hasAccount`) —
  true only for the strings `"true"` or `"1"`
- Date coercion at line 46 (`createdAt`, `finishedAt`, `executionTime`)
- `if (val === undefined) continue;` at line 50 — empty values are dropped
- Relational branches for `entity === "manovr"` (lines 53-93): `sourceLine`,
  `destinationLine`, `train`, `rahbar1`, `rahbar2`, `creator`
- The soft-delete defaults at lines 129-134:

```ts
  if (entity === "manovr" && !where.status) {
    where.status = { not: 3 }; // مانورهای حذف نشده
  }
  if (entity === "train" && where.isDisposed === undefined) {
    where.isDisposed = false; // قطارهای اسقاط نشده
  }
```

`report-engine.ts` also imports Prisma at module scope (line 1) — same caveat
as `scheduler.ts`.

**`src/lib/export-helpers.ts:19-27`** — `farsi(text)`. Reverses word order and
reverses the characters of any word containing a Persian codepoint. Also
imports `pdfmake` and `exceljs` at module scope.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Install   | `npm install`              | exit 0              |
| Typecheck | `npx tsc --noEmit`         | exit 0, no output   |
| Lint      | `npm run lint`             | exit 0 (after step 5) |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |

This is a Windows machine running Git Bash. Use forward slashes in paths.

## Scope

**In scope** (the only files you should create or modify):
- `package.json` — add devDependencies and scripts
- `vitest.config.ts` (create)
- `eslint.config.mjs` — rule severity overrides only
- `src/lib/cron.ts` (create — extracted pure helpers, see Step 4)
- `src/lib/scheduler.ts` — re-export only, see Step 4
- `src/lib/__tests__/perms.test.ts` (create)
- `src/lib/__tests__/audit.test.ts` (create)
- `src/lib/__tests__/cron.test.ts` (create)
- `src/lib/__tests__/report-engine.test.ts` (create)
- `src/lib/__tests__/export-helpers.test.ts` (create)
- `.gitignore` — add `/coverage` if not already present (it is, at line 14 — verify and skip)

**Out of scope** (do NOT touch, even though they look related):
- Any of the 206 `any` / `as any` / `@ts-ignore` sites. Silencing the rule is
  the deliverable here; typing them is deferred work, not this plan.
- `src/app/**` — no application code changes at all in this plan.
- `next.config.ts` — leave the standalone output config alone.
- Any behaviour change to the functions under test. If a test you write fails
  because the function is wrong, that is a finding, not a licence to fix it —
  see STOP conditions.

## Git workflow

- Branch: `advisor/001-verification-baseline`
- The repo has one commit with a plain non-conventional message
  (`Initial commit from Create Next App`), so there is no commit convention to
  match. Use plain imperative subjects, e.g. `Add Vitest and seed unit tests
  for src/lib`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add Vitest as a devDependency

Run:

```bash
npm install --save-dev vitest@^3 @vitejs/plugin-react vite-tsconfig-paths
```

`vite-tsconfig-paths` is what makes the `@/*` alias from `tsconfig.json:19-21`
resolve inside tests without duplicating the mapping.

**Verify**: `node -e "const p=require('./package.json');console.log(p.devDependencies.vitest, p.devDependencies['vite-tsconfig-paths'])"` → prints two version strings, neither `undefined`.

### Step 2: Add the test scripts to `package.json`

Edit the `scripts` block so it reads:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:run": "vitest run",
    "build:electron": "node scripts/build.js"
  },
```

**Verify**: `npm run test:run` → exits non-zero with a "No test files found"
message. That is the expected result at this point — it proves the runner is
wired up and there is nothing to run yet.

### Step 3: Create `vitest.config.ts`

Create the file at the repo root:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
});
```

`environment: "node"` is correct — every function in this plan is pure
server-side logic with no DOM. `globals: false` means tests must import
`describe` / `it` / `expect` from `vitest` explicitly; do that consistently.

**Verify**: `npx tsc --noEmit` → exit 0 (the new config file typechecks).

### Step 4: Extract the cron helpers into `src/lib/cron.ts`

`src/lib/scheduler.ts` imports `@/lib/prisma`, `@/lib/backup`,
`@/lib/report-engine`, and `@/lib/export-helpers` at module scope, which pulls
in Prisma, `pdfmake`, and `exceljs`. Importing it from a unit test is slow and
brittle. Move the two pure cron functions out.

Create `src/lib/cron.ts` containing **exactly** the current bodies of
`matchCronField` and `cronMatch` from `src/lib/scheduler.ts:16-60`, moved
verbatim — do not change their logic, comments, or behaviour. Export both.

Then in `src/lib/scheduler.ts`:
- delete the two moved function bodies,
- add `import { cronMatch } from "@/lib/cron";` near the other imports,
- add `export { cronMatch };` so any existing importer of
  `cronMatch` from `scheduler.ts` keeps working.

The call site at `src/lib/scheduler.ts:169` (`if (cronMatch(sr.cron, now))`)
must continue to work unchanged.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "function matchCronField\|export function cronMatch" src/lib/cron.ts` → both present
- `grep -n "function matchCronField" src/lib/scheduler.ts` → no matches

### Step 5: Make `npm run lint` exit 0

Rewrite `eslint.config.mjs` to keep everything it has today and add a rules
override block after the two spread configs:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Deferred, not forgiven: ~206 `any` sites across src/ predate any test
      // coverage. Typing them is tracked separately; until then this must not
      // block the lint gate that every other plan verifies against.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "scripts/**",
    "prisma/*.mjs",
  ]),
]);

export default eslintConfig;
```

Then run `npm run lint` and read the output. If errors remain, they are
**not** `no-explicit-any` and are worth looking at individually — fix the
genuine ones (an unescaped entity, a missing hook dependency that is actually a
bug) rather than adding more rules to the override list. If any remaining error
would require changing application behaviour to satisfy, that is a STOP
condition.

**Verify**: `npm run lint` → exit 0. Confirm with
`npm run lint; echo "EXIT=$?"` → `EXIT=0`.

### Step 6: Write `src/lib/__tests__/perms.test.ts`

Cover `getRoleLevel`, `isRoleAllowedToManage`, and `permsInclude`. Do **not**
import `hasPerm` or `getUserPerms` — both touch Prisma and `next/cache`.

Required cases:
- `getRoleLevel` returns 100/80/50/30 for roles 4/1/2/3 and 0 for role 0
- `getRoleLevel` returns 0 for an unknown role such as 99
- `isRoleAllowedToManage(4, 1)` is `true`
- `isRoleAllowedToManage(1, 1)` is `false` — a peer cannot manage a peer
- `isRoleAllowedToManage(2, 1)` is `false` — lower cannot manage higher
- `isRoleAllowedToManage(1, 0)` is `true`
- `permsInclude(["manovr.view"], "manovr.view")` is `true`;
  `permsInclude([], "manovr.view")` is `false`

Structure:

```ts
import { describe, it, expect } from "vitest";
import { getRoleLevel, isRoleAllowedToManage, permsInclude } from "@/lib/perms";

describe("getRoleLevel", () => {
  it("ranks super admin above admin", () => {
    expect(getRoleLevel(4)).toBeGreaterThan(getRoleLevel(1));
  });
  // ...
});
```

**Verify**: `npm run test:run` → all pass, at least 7 assertions in this file.

### Step 7: Write `src/lib/__tests__/audit.test.ts`

Import only `computeDiff` from `@/lib/audit`.

> `src/lib/audit.ts` imports `@/lib/prisma` and `@/lib/events` at module scope.
> Vitest will load those modules but neither opens a connection on import
> (`src/lib/prisma.ts` only constructs a `PrismaClient`; `src/lib/events.ts`
> only constructs an `EventEmitter`), so a plain import is fine here. If the
> import turns out to be slow or throws, that is a STOP condition — do not
> start mocking Prisma to work around it.

Required cases:
- **`passwordHash` never appears in the diff**, even when it changed. This is
  the regression test that protects plan 003's assumption.
  `computeDiff({ passwordHash: "a", role: 1 }, { passwordHash: "b", role: 2 })`
  → has a `role` key, does **not** have a `passwordHash` key.
- `createdAt`, `updatedAt`, and `id` are likewise excluded
- Object-valued and array-valued keys are skipped (the `typeof === "object"`
  guard at line 16)
- Unchanged scalars produce no entry
- A `null` → value change is recorded as `{ old: null, new: value }`
- `computeDiff(null, { a: 1 })` does not throw and reports `a`

**Verify**: `npm run test:run` → all pass.

### Step 8: Write `src/lib/__tests__/cron.test.ts`

Import `cronMatch` from `@/lib/cron` (the module created in Step 4), **not**
from `@/lib/scheduler`.

Because `cronMatch` converts to `Asia/Tehran` internally, construct test dates
by their Tehran wall-clock meaning. The clearest way is to build a UTC instant
and compute the expected Tehran fields with the same
`toLocaleString("en-US", { timeZone: "Asia/Tehran" })` conversion the function
uses, then assert against a cron expression built from those fields. Avoid
hardcoding a Tehran hour for a fixed UTC instant — Iran's offset handling has
changed historically and a brittle test here is worse than no test.

Required cases:
- An expression with fewer than 5 fields returns `false`
- `"* * * * *"` returns `true` for any date
- A step field `"*/5"` in the minute position matches minute 0, 5, 10 and not 7
- A list field `"1,15,30"` matches 15 and not 16
- A range field `"9-17"` in the hour position matches 12 and not 20
- Extra whitespace between fields is tolerated (`cronMatch("*  *  * * *", d)`)

**Verify**: `npm run test:run` → all pass.

### Step 9: Write `src/lib/__tests__/report-engine.test.ts`

Import only `buildPrismaWhere` from `@/lib/report-engine`. Do **not** import
`executeReportQuery` — it calls Prisma.

Required cases:
- Numeric coercion: `{ field: "status", operator: "equals", value: "2" }` on
  entity `manovr` → `where.status === 2` (a number, not the string `"2"`)
- Boolean coercion: `{ field: "isDisposed", operator: "equals", value: "true" }`
  on entity `train` → `where.isDisposed === true`; value `"false"` → `false`
- Date coercion: `{ field: "createdAt", operator: "gt", value: "2026-01-01" }`
  → `where.createdAt.gt` is a `Date`
- Empty value is dropped: `{ field: "status", operator: "equals", value: "" }`
  → `where.status` is the soft-delete default `{ not: 3 }`, not `undefined`
- Relational branch: `{ field: "train", operator: "contains", value: "AC-1" }`
  on entity `manovr` → `where.train` is `{ code: { contains: "AC-1" } }`
- Relational OR branch: `field: "rahbar1"` → `where.rahbar1.OR` has two
  entries covering `firstName` and `lastName`
- Soft-delete default: `buildPrismaWhere("manovr", [])` → `{ status: { not: 3 } }`
- Soft-delete default: `buildPrismaWhere("train", [])` → `{ isDisposed: false }`
- An explicit `status` filter overrides the manovr soft-delete default
- `between` on a numeric field uses `gte`/`lte`

**Verify**: `npm run test:run` → all pass, at least 10 assertions in this file.

### Step 10: Write `src/lib/__tests__/export-helpers.test.ts`

Import only `farsi` from `@/lib/export-helpers`.

> This module imports `pdfmake/js/Printer`, `exceljs`, and
> `arabic-persian-reshaper` at module scope. Importing it in a test loads all
> three. If that import throws or takes more than ~10 seconds, STOP and report
> — do not begin restructuring `export-helpers.ts`; a follow-up plan can
> extract `farsi` the way Step 4 extracted the cron helpers.

Required cases:
- `farsi("")` returns `""`
- An ASCII-only string has its word order reversed but each word's characters
  left intact: `farsi("AC 101")` → `"101 AC"`
- A Persian string round-trips to a non-empty string of the same length class
  (assert it is non-empty and differs from the input — do not hardcode the
  exact reshaped output, which depends on the reshaper's version)

Keep this file small. It is a smoke test, not a text-shaping specification.

**Verify**: `npm run test:run` → all pass.

### Step 11: Confirm the full gate

Run all four in order:

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: every command exits 0. If `npm run build` fails, see STOP
conditions — it passed before this plan started.

## Test plan

- New files: `src/lib/__tests__/perms.test.ts`, `audit.test.ts`,
  `cron.test.ts`, `report-engine.test.ts`, `export-helpers.test.ts`.
- There is no existing test to model after — this plan creates the first ones.
  Follow the structure shown in Step 6: explicit `import { describe, it, expect }
  from "vitest"`, one `describe` per exported function, one `it` per behaviour,
  test names in English.
- Expected total: roughly 30 assertions across 5 files. The exact count does
  not matter; the coverage listed per step does.
- Verification: `npm run test:run` → exit 0, 5 test files, 0 failures.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint; echo $?` prints `0`
- [ ] `npm run test:run` exits 0 and reports 5 passing test files
- [ ] `npm run build` exits 0
- [ ] `ls src/lib/__tests__/` lists exactly the 5 files named in Scope
- [ ] `src/lib/cron.ts` exists and exports `cronMatch`
- [ ] `grep -n "function matchCronField" src/lib/scheduler.ts` returns no matches
- [ ] `git status --porcelain` lists only files from the "In scope" list
      (plus `package-lock.json`, which `npm install` will update)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- A test you wrote fails because the function under test is genuinely wrong.
  Report the discrepancy with the input and both values. Do **not** change the
  function — several later plans depend on current behaviour being documented
  accurately before it changes.
- `npm run build` fails after adding Vitest. Revert the Vitest install and
  report; do not begin reconfiguring the Next.js build.
- Importing `@/lib/export-helpers` or `@/lib/audit` in a test throws or hangs.
  Report it; do not start mocking Prisma, `pdfmake`, or `exceljs`.
- After Step 5, `npm run lint` still reports errors that would require changing
  application behaviour to satisfy. List them and stop.
- You find yourself editing a file under `src/app/`. Nothing in this plan
  requires it.

## Maintenance notes

- The `no-explicit-any` downgrade in `eslint.config.mjs` is a deliberate,
  documented deferral. The comment in the config says so; keep it there. If
  someone later types the `any` sites, promote the rule back to `error` in the
  same commit.
- `src/lib/cron.ts` now holds the cron parser. It is a hand-rolled
  implementation with known gaps (no `L`/`W`/`#` support, day-of-week `7` is
  not aliased to Sunday, and `dayPattern` and `dayOfWeekPattern` are ANDed
  where standard cron ORs them). The tests written here document current
  behaviour, not correct cron semantics. Do not "fix" cron behaviour without a
  plan of its own — `src/lib/scheduler.ts:169` drives real scheduled reports.
- A reviewer should check that the `audit.test.ts` `passwordHash` case is
  present and passing. Plans 003 and 004 assume `computeDiff` keeps excluding it.
- Deferred out of this plan: integration tests that touch Prisma. That needs a
  test database strategy (SQLite file per run, or `prisma migrate reset`
  against a temp `DATABASE_URL`) and is worth its own plan.
