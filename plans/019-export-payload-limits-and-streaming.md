# Plan 019: Cap report queries at the source so a large export cannot exhaust memory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Setup on a fresh checkout**: run `npm install` **and** `npx prisma generate`
> before anything else. There is no `postinstall` hook, and without the
> generated Prisma client `npx tsc --noEmit` fails with ~25 phantom `TS7006`
> errors.
>
> **Drift check (run first)**:
> `git diff --stat d197693..HEAD -- src/lib/report-engine.ts src/lib/export-helpers.ts src/app/actions/report.ts src/lib/scheduler.ts src/app/api/export/excel/route.ts src/app/api/export/pdf/route.ts`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `d197693`, 2026-07-29

## Why this matters

Every dynamic report — on-screen, Excel, PDF, and scheduled — runs through one
function, `executeReportQuery` in `src/lib/report-engine.ts`. It issues
`prisma.<entity>.findMany({ where, orderBy, include })` with **no `take`**. For a
`manovr` report it pulls six joined relations per row. An operator who exports
"all maneuvers" with no date filter materializes the entire history — every row
plus every relation object — into the Node heap at once. On the packaged
Electron deployment that is a single Node process on terminal hardware; a large
enough export spikes memory and can crash the server the desktop app depends on.

A previous change (commit `2ce9246`) added a `MAX_EXPORT_RECORDS = 5000` guard,
but it guards the **wrong place**. The check is
`if (res.records.length > MAX_EXPORT_RECORDS)` in the two export routes —
evaluated **after** `executeReportQuery` has already fetched and materialized
every row. The heap allocation this is meant to prevent has already happened by
the time the check runs. And two of the four callers have no check at all:

- **The scheduler** (`src/lib/scheduler.ts:33`) runs unattended, unbounded.
- **The report builder** (`ReportBuilderClient.tsx:341`) renders on-screen,
  unbounded — a 40,000-row client table will freeze the browser.

There is a second, sharper problem hiding here. **The moment a `take` cap is
added to the query, the existing `res.records.length > MAX_EXPORT_RECORDS` check
becomes dead code** — `records.length` can never exceed the cap, so the branch
never fires, and the export silently truncates to 5000 rows in a file that looks
complete. A silently-partial maneuver report is a data-integrity problem, not a
performance one.

This plan moves the limit to where the query is, makes truncation a value every
caller must handle, and replaces the post-hoc length checks before they turn
into silent truncation.

## Current state

### The unbounded query — `src/lib/report-engine.ts:175-241`

```ts
// اجرای مستقیم کوئری بدون بررسی مجوزهای نشست (کاربرد در زمان‌بند یا گزارش‌های داخلی)
export async function executeReportQuery(config: ReportConfig) {
  const where = buildPrismaWhere(config.entity, config.filters);

  let orderBy: any = undefined;
  if (config.sortField) {
    // ... builds orderBy from config.sortField, including relational sorts ...
  }

  let records: any[] = [];

  if (config.entity === "manovr") {
    records = await prisma.manovr.findMany({
      where,
      orderBy,
      include: { sourceLine: true, destinationLine: true, train: true, rahbar1: true, rahbar2: true, creator: true },
    });
  } else if (config.entity === "train") {
    records = await prisma.train.findMany({
      where,
      orderBy,
      include: { line: true },
    });
  } else if (config.entity === "line") {
    records = await prisma.line.findMany({
      where,
      orderBy,
    });
  } else if (config.entity === "personnel") {
    records = await prisma.personnel.findMany({
      where,
      orderBy,
      select: {
        ...PERSONNEL_SAFE_SELECT,
        accessRole: true,
      },
    });
  }

  return records;
}
```

No `take` on any of the four branches. Return type is `any[]`.

Note `orderBy` is `undefined` when `config.sortField` is unset — so "the first N
rows" is currently database order, which is not stable. A cap needs a
deterministic order for truncation to be reproducible (Step 2).

### The misplaced constant — `src/lib/export-helpers.ts:7`

```ts
export const MAX_EXPORT_RECORDS = 5000;
```

It lives in `export-helpers.ts`, which imports `pdfmake` and `exceljs` at module
scope. `report-engine.ts` must not import from there (it would pull those heavy
deps into every module that touches the report engine). The constant belongs in
`report-engine.ts`. See Step 1.

### The post-hoc check that will become dead code — `src/app/api/export/excel/route.ts:14-32`

```ts
  const config = await req.json();
  const [res, manovrTypeL, /* ...lookups... */] = await Promise.all([
    runDynamicReport(config),
    // ...
  ]);

  if (res.error || !res.records) {
    return new NextResponse(res.error || "خطا در دریافت داده‌ها", { status: 400 });
  }

  if (res.records.length > MAX_EXPORT_RECORDS) {
    return new NextResponse(`تعداد رکوردهای درخواستی (${res.records.length}) از سقف مجاز خروجی (${MAX_EXPORT_RECORDS}) بیشتر است. لطفاً فیلترهای محدودکننده‌تری اعمال نمایید.`, { status: 400 });
  }
```

`src/app/api/export/pdf/route.ts:26-32` is byte-for-byte identical in this
region (different buffer generator below it). Both check
`res.records.length`, which after Step 2 can never exceed the cap.

### The middle layer — `src/app/actions/report.ts:11-23`

```ts
export async function runDynamicReport(config: ReportConfig) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  try {
    const records = await executeReportQuery(config);
    return { records };
  } catch (err: any) {
    return { error: `خطا در اجرای گزارش: ${err.message}` };
  }
}
```

This is the single choke point that both export routes and the report builder
call. Threading truncation through here reaches all three at once.

### The unattended caller — `src/lib/scheduler.ts:28-45`

```ts
async function executeScheduledReportJob(sr: any): Promise<string> {
  const report = sr.savedReport;
  const config: ReportConfig = JSON.parse(report.config);

  // ۱. کوئری داده‌ها از دیتابیس
  const records = await executeReportQuery(config);

  // ۲. تولید بافر فایل بر اساس فرمت انتخابی
  let buffer: Uint8Array;
  const ext = sr.format === "pdf" ? "pdf" : "xlsx";
  const safeFields = sanitizeReportFields(config.entity, config.fields);

  if (sr.format === "pdf") {
    buffer = await generatePDFBuffer(config.entity, safeFields, records);
  } else {
    buffer = await generateExcelBuffer(config.entity, safeFields, records);
  }
  // ... writes the file, records an audit entry, notifies recipients ...
}
```

No cap, no truncation awareness. This is the path most likely to hit the limit,
because scheduled reports accumulate over time and nobody is watching.

### The on-screen caller — `src/app/(main)/reports/ReportBuilderClient.tsx:340-348`

```tsx
    startTransition(async () => {
      const res = await runDynamicReport(config);
      if (res.error) {
        setError(res.error);
      } else {
        setRecords(res.records || []);
      }
    });
```

A `"use client"` file, 1666 lines. It already destructures `res.records`; it
needs to also read a truncation flag and surface it. **Minimal edit only** — see
Step 5 and its STOP condition.

### The exemplar for the return shape

There is no existing `{ records, total, truncated }` shape to copy. The nearest
convention is the `{ ok, error }` / `{ records }` / `{ error }` result objects
used throughout `src/app/actions/`. Follow that style: a plain object, no class.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Install   | `npm install`              | exit 0              |
| Generate Prisma client | `npx prisma generate` | exit 0        |
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |
| Dev run   | `npm run dev`              | serves on :3000     |

## Scope

**In scope** (the only files you should modify or create):
- `src/lib/report-engine.ts` — move the constant here, cap the query, change the return shape
- `src/lib/export-helpers.ts` — remove the constant (re-export for one release, see Step 1)
- `src/app/actions/report.ts` — thread `total`/`truncated` through `runDynamicReport`
- `src/lib/scheduler.ts` — handle truncation in the scheduled job
- `src/app/api/export/excel/route.ts` and `pdf/route.ts` — replace the `.length` check
- `src/app/(main)/reports/ReportBuilderClient.tsx` — surface truncation (minimal)
- `src/lib/__tests__/report-engine.test.ts` — extend (created by plan 001)

**Out of scope** (do NOT touch, even though they look related):
- `buildPrismaWhere` and `sanitizeReportFields` in `report-engine.ts`. The cap is
  a separate concern; leave the filter builder exactly as it is (plan 001 and
  plan 003 test it).
- `PERSONNEL_SAFE_SELECT` and the personnel field whitelist (plan 003 owns it).
  Keep the `select` on the personnel branch exactly as-is.
- Any actual streaming / chunked-write rewrite of the Excel or PDF generators.
  The original version of this plan proposed batched `take`/`skip` fetching;
  that is unnecessary once the total is capped at 5000, and `exceljs`/`pdfmake`
  buffer the whole document in memory anyway, so streaming the DB read would not
  change the peak. Capping the row count is the fix. **Do not implement
  batching.**
- The report builder's rendering, filtering, chart, or state logic beyond adding
  a truncation notice.
- Making the cap user-configurable via settings. A fixed 5000 is right for this
  deployment; configurability is a separate decision (noted in Maintenance).

## Git workflow

- Branch: `advisor/019-export-payload-limits`
- Commit per logical unit (engine cap; caller updates) if you like a bisectable
  history. Plain imperative subjects, e.g. `Cap report queries at 5000 rows`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move the cap constant into the report engine

In `src/lib/report-engine.ts`, near the top with the other exports, add:

```ts
// سقف تعداد رکوردهای هر گزارش. کوئری در همین سقف محدود می‌شود تا یک خروجی بزرگ
// حافظه‌ی پروسه را اشباع نکند. این مقدار در report-engine تعریف شده — نه در
// export-helpers — تا وابستگی به pdfmake/exceljs وارد گراف ماژول موتور گزارش نشود.
export const MAX_EXPORT_RECORDS = 5000;
```

Then remove the definition from `src/lib/export-helpers.ts:7`. To avoid touching
every importer in one go, keep a re-export in `export-helpers.ts` so existing
imports still resolve:

```ts
export { MAX_EXPORT_RECORDS } from "@/lib/report-engine";
```

Confirm this does not create a cycle: `report-engine.ts` imports only
`@/lib/prisma`; it must **not** import anything from `export-helpers.ts`. Check:

```bash
grep -n "export-helpers" src/lib/report-engine.ts
```

Expected: no matches.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "MAX_EXPORT_RECORDS = 5000" src/lib/report-engine.ts` → present
- `grep -c "MAX_EXPORT_RECORDS = 5000" src/lib/export-helpers.ts` → 0

### Step 2: Cap the query and return truncation state

Rewrite `executeReportQuery` in `src/lib/report-engine.ts` so it (a) counts the
true total, (b) fetches at most `MAX_EXPORT_RECORDS` rows, and (c) returns a
structured result. Target shape:

```ts
export interface ReportQueryResult {
  records: any[];
  total: number;        // تعداد کل رکوردهای منطبق، پیش از اعمال سقف
  truncated: boolean;   // آیا total از سقف بیشتر بوده و نتیجه برش خورده است؟
}

export async function executeReportQuery(config: ReportConfig): Promise<ReportQueryResult> {
  const where = buildPrismaWhere(config.entity, config.filters);

  const orderBy = buildReportOrderBy(config);   // منطق فعلی، استخراج‌شده
  const take = MAX_EXPORT_RECORDS;

  let records: any[] = [];
  let total = 0;

  if (config.entity === "manovr") {
    total = await prisma.manovr.count({ where });
    records = await prisma.manovr.findMany({
      where, orderBy, take,
      include: { sourceLine: true, destinationLine: true, train: true, rahbar1: true, rahbar2: true, creator: true },
    });
  } else if (config.entity === "train") {
    total = await prisma.train.count({ where });
    records = await prisma.train.findMany({ where, orderBy, take, include: { line: true } });
  } else if (config.entity === "line") {
    total = await prisma.line.count({ where });
    records = await prisma.line.findMany({ where, orderBy, take });
  } else if (config.entity === "personnel") {
    total = await prisma.personnel.count({ where });
    records = await prisma.personnel.findMany({
      where, orderBy, take,
      select: { ...PERSONNEL_SAFE_SELECT, accessRole: true },
    });
  }

  return { records, total, truncated: total > MAX_EXPORT_RECORDS };
}
```

Three things to get right:

1. **Extract the existing `orderBy`-building block into a helper**
   `buildReportOrderBy(config)` (same file). Move the current logic verbatim —
   do not change how relational sorts are built. Then add a **stable default**
   when `config.sortField` is unset:

   ```ts
   function buildReportOrderBy(config: ReportConfig): any {
     if (!config.sortField) return { id: "desc" }; // ترتیب پایدار برای برش قابل‌تکرار
     // ... the existing per-entity sortField logic, unchanged ...
   }
   ```

   The `{ id: "desc" }` default is a **deliberate, minor behavior change**: with
   no sort chosen, reports now show newest-first instead of database order, and
   truncation keeps the newest 5000. Note it in your report. Every entity here
   has an `id` column, so this is safe for all four.

2. **`count` uses the same `where`** as `findMany`. It is a cheap indexed count,
   far cheaper than the unbounded materialization it prevents. Do not skip it —
   it is what lets callers report the true total.

3. **The return type changes from `any[]` to `ReportQueryResult`.** This ripples
   to two direct callers (Steps 3 and 4). That ripple is the point: it forces
   every caller to reckon with truncation.

**Verify**:
- `npx tsc --noEmit` → will report errors at the two call sites until Steps 3–4
  are done. That is expected mid-refactor. Confirm the errors are *only* in
  `report.ts` and `scheduler.ts`.
- `grep -c "take: MAX_EXPORT_RECORDS\|take," src/lib/report-engine.ts` → at least 4
- `grep -c "\.count({ where })" src/lib/report-engine.ts` → 4

### Step 3: Thread truncation through `runDynamicReport`

In `src/app/actions/report.ts`, update `runDynamicReport` to pass the new fields
back to its callers:

```ts
  try {
    const { records, total, truncated } = await executeReportQuery(config);
    return { records, total, truncated };
  } catch (err: any) {
    return { error: `خطا در اجرای گزارش: ${err.message}` };
  }
```

Leave the permission check and the `{ error }` shape unchanged. Callers that
only read `res.records` keep working; callers that want the count now have it.

**Verify**:
- `npx tsc --noEmit` → the `report.ts` error from Step 2 is gone
- `grep -n "truncated" src/app/actions/report.ts` → present

### Step 4: Replace the dead length-check in both export routes

This is the hazard from "Why this matters": after Step 2, `res.records.length`
can never exceed the cap, so the existing check never fires. Replace it in
**both** `src/app/api/export/excel/route.ts` and `src/app/api/export/pdf/route.ts`.
Change:

```ts
  if (res.records.length > MAX_EXPORT_RECORDS) {
    return new NextResponse(`تعداد رکوردهای درخواستی (${res.records.length}) از سقف مجاز خروجی (${MAX_EXPORT_RECORDS}) بیشتر است. لطفاً فیلترهای محدودکننده‌تری اعمال نمایید.`, { status: 400 });
  }
```

to check the true total instead:

```ts
  if (res.truncated) {
    return new NextResponse(`تعداد رکوردهای منطبق (${res.total}) از سقف مجاز خروجی (${MAX_EXPORT_RECORDS}) بیشتر است. لطفاً فیلترهای محدودکننده‌تری (مثلاً بازه‌ی تاریخ) اعمال نمایید.`, { status: 400 });
  }
```

The refusal is deliberate: an export file that silently omits 37,000 of 42,000
rows is worse than an error telling the operator to narrow the range. Keep the
`MAX_EXPORT_RECORDS` import (now resolving from `report-engine` via the
re-export, or repoint it directly to `@/lib/report-engine` — either is fine).

**Verify**:
- `grep -rn "res.records.length > MAX" src/app/api/export/` → no matches
- `grep -rc "res.truncated" src/app/api/export/excel/route.ts src/app/api/export/pdf/route.ts` → 1 each

### Step 5: Surface truncation in the report builder (minimal)

In `src/app/(main)/reports/ReportBuilderClient.tsx`, the on-screen path should
show the capped rows **and** tell the user they are capped — rendering 5000 rows
is fine; rendering 42,000 would freeze the browser, which the cap now prevents.

At the `runDynamicReport` call (around line 341), read the flag and set a notice.
The component already has `setError`/`setRecords` state; add or reuse a lightweight
notice state:

```tsx
    startTransition(async () => {
      const res = await runDynamicReport(config);
      if (res.error) {
        setError(res.error);
      } else {
        setRecords(res.records || []);
        if (res.truncated) {
          setError(`نتایج به ${MAX_EXPORT_RECORDS.toLocaleString("fa-IR")} رکورد اول محدود شد (کل: ${(res.total || 0).toLocaleString("fa-IR")}). برای دیدن همه، فیلتر اعمال کنید.`);
        }
      }
    });
```

Import `MAX_EXPORT_RECORDS` from `@/lib/report-engine`. Reusing `setError` for
the notice is acceptable if the component has no separate info-banner state;
if it does, prefer that. **This is the only change to this 1666-line file.**

**STOP** if surfacing the notice requires more than adding this branch and one
import — e.g. if the component has no usable notice/error surface. Report what
you found rather than refactoring the component.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `git diff --stat "src/app/(main)/reports/ReportBuilderClient.tsx"` → a small
  single-digit line count

### Step 6: Handle truncation in the scheduled job

In `src/lib/scheduler.ts`, `executeScheduledReportJob` must destructure the new
shape and record truncation, because this path runs unattended and a silently
partial scheduled report is exactly the failure this plan exists to prevent.

Change:

```ts
  const records = await executeReportQuery(config);
```

to:

```ts
  const { records, total, truncated } = await executeReportQuery(config);
```

Then, where the job records its audit entry / builds the recipient notification
(later in the same function / its caller), append a truncation note when
`truncated` is true — e.g. include `(گزارش به ${MAX_EXPORT_RECORDS} رکورد اول از
${total} محدود شد)` in the summary/notification body. Produce the capped file
rather than skipping — a partial-but-labeled report is more useful to recipients
than none — but the label is mandatory.

Import `MAX_EXPORT_RECORDS` from `@/lib/report-engine` (it is already imported
from there for `sanitizeReportFields` — add to the same import).

**Verify**:
- `npx tsc --noEmit` → exit 0 (the last Step-2 error is now resolved)
- `grep -n "truncated" src/lib/scheduler.ts` → present

### Step 7: Extend the tests

The `count`+`take` query itself hits Prisma and cannot be unit-tested without the
DB harness plan 001 deferred. What **is** testable is the truncation decision.
Extract it into a pure, exported helper in `report-engine.ts` and test that:

```ts
// تصمیم برش: آیا total از سقف گذشته است؟ (خالص، قابل تست)
export function isTruncated(total: number, max: number = MAX_EXPORT_RECORDS): boolean {
  return total > max;
}
```

Use it inside `executeReportQuery` (`truncated: isTruncated(total)`) so the tested
function is the one that runs.

Extend `src/lib/__tests__/report-engine.test.ts` with a `describe` block:
- `isTruncated(4999)` → false
- `isTruncated(5000)` → false (exactly at the cap is not truncated)
- `isTruncated(5001)` → true
- `isTruncated(0)` → false
- `MAX_EXPORT_RECORDS` is exported and equals 5000

Also add one assertion pinning the constant's location so it is not silently
moved back: importing `MAX_EXPORT_RECORDS` from `@/lib/report-engine` resolves to
a number.

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 8: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

### Step 9: Confirm at runtime

Start the dev server (`npm run dev`), log in with `report.build` +
`report.export`, and open `/reports`.

1. Run a report that matches **fewer** than 5000 rows. Confirm it renders and an
   Excel export downloads a complete file.
2. If the dataset can exceed 5000 (or you can lower `MAX_EXPORT_RECORDS`
   temporarily to a small number like 5 to simulate): run a report that exceeds
   the cap. Confirm the on-screen view shows the truncation notice, and an
   Excel/PDF export returns the 400 "narrow your filters" error rather than a
   partial file. **Restore the constant to 5000 if you changed it.**

**Verify**: record both outcomes. If you temporarily changed the constant, prove
you restored it: `grep -n "MAX_EXPORT_RECORDS = 5000" src/lib/report-engine.ts`.

## Test plan

- Extended: `src/lib/__tests__/report-engine.test.ts` — the `isTruncated` cases
  and the constant assertion from Step 7. Model after the existing
  `buildPrismaWhere` describe block in the same file (plan 001 style: explicit
  `import { describe, it, expect } from "vitest"`, English names).
- `executeReportQuery`, `runDynamicReport`, the routes, and the scheduler are not
  unit-tested — all hit Prisma or the network, and this repo has no DB test
  harness (plan 001 deferred one deliberately). They are covered by the `grep`
  checks per step and the runtime walk in Step 9.
- The most important guard is that the on-screen and export paths behave
  differently on truncation (notice vs. refusal); verify that in Step 9 and
  record it.
- Verification: `npm run test:run` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "MAX_EXPORT_RECORDS = 5000" src/lib/report-engine.ts` returns a match
- [ ] `grep -c "MAX_EXPORT_RECORDS = 5000" src/lib/export-helpers.ts` returns 0
- [ ] `grep -c "\.count({ where })" src/lib/report-engine.ts` returns 4
- [ ] `grep -c "take" src/lib/report-engine.ts` shows a `take` on each of the four `findMany` branches
- [ ] `grep -rn "res.records.length > MAX" src/app/api/export/` returns no matches
- [ ] `grep -rc "res.truncated" src/app/api/export/excel/route.ts src/app/api/export/pdf/route.ts` returns 1 each
- [ ] `grep -n "truncated" src/lib/scheduler.ts` returns a match
- [ ] `grep -n "export-helpers" src/lib/report-engine.ts` returns no matches (no cycle)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new `isTruncated` cases
- [ ] `npm run build` exits 0
- [ ] Step 9 outcomes recorded; if the constant was lowered for testing, it is back to 5000
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 019 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- Moving `MAX_EXPORT_RECORDS` into `report-engine.ts` creates an import cycle —
  i.e. `grep -n "export-helpers" src/lib/report-engine.ts` finds a match after
  your change. `report-engine.ts` must depend only on `@/lib/prisma`.
- After Step 2, `npx tsc --noEmit` reports errors in files **other than**
  `report.ts` and `scheduler.ts`. That means a caller you did not expect reads
  `executeReportQuery`'s return value. Find it (`grep -rn "executeReportQuery" src/`)
  and report before adapting it.
- Surfacing the truncation notice in `ReportBuilderClient.tsx` requires more than
  the single branch and import in Step 5.
- A Prisma `count` rejects the `where` object that `findMany` accepts. It should
  not — both take the same `where` — so report the exact error rather than
  reshaping the filter.
- You are tempted to implement chunked/batched fetching or streaming. It is
  explicitly out of scope; the cap makes it unnecessary.

## Maintenance notes

- **The invariant: every report read goes through `executeReportQuery`, and it is
  capped.** No caller should ever call `prisma.manovr.findMany` (or the other
  entities) for a report directly — that would reintroduce the unbounded path.
  A reviewer seeing a new direct `findMany` for report data should treat it as
  this bug recurring.
- **`truncated` must be handled, not ignored.** The three callers diverge on
  purpose: the export routes *refuse* (a partial file is dangerous), the on-screen
  builder *shows a notice* (a capped table is fine), the scheduler *labels* (a
  partial-but-marked file beats none). A fourth caller must make the same choice
  consciously.
- The `{ id: "desc" }` default order (Step 2) changed the default display order
  for reports with no sort chosen. If any saved report or downstream consumer
  depended on the old database-order behavior, this is where it changed. It also
  means "the first 5000" is now "the newest 5000" — the useful truncation
  semantics.
- `MAX_EXPORT_RECORDS = 5000` is a fixed constant. If operators legitimately need
  larger exports, the right move is not to raise it blindly but to make it
  configurable via `AppSetting` (the settings pattern already exists) with a hard
  ceiling — a separate, deliberate change.
- The `export-helpers.ts` re-export of `MAX_EXPORT_RECORDS` is a compatibility
  shim so route imports did not all have to change at once. A follow-up can
  repoint the two route imports to `@/lib/report-engine` and delete the shim.
- Deferred, still real: `exceljs` and `pdfmake` buffer the entire document in
  memory during generation. At 5000 rows this is fine. If the cap is ever raised
  substantially, the generators themselves — not the DB read — become the memory
  ceiling, and *that* is when streaming generation would matter.
