# Plan 007: Confine scheduled-report output paths and scope schedules to their owner

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: Do NOT use `git diff` for this. This repository
> has exactly one commit (`3ec213d`) and essentially the entire application
> lives in uncommitted working-tree state, so a diff against HEAD is
> meaningless. Instead: open each file quoted under "Current state" and confirm
> the quoted lines still match. On any mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: security
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

A scheduled report is a stored instruction that the server executes unattended,
once a minute, forever. Creating one requires only the `report.build`
permission — which legacy role 3 ("Viewer", the lowest role with any access)
holds by default per `src/lib/perms.ts:73`.

Three things are wrong with what that instruction is allowed to say:

1. **The output directory is an unvalidated string.** The scheduler resolves it
   with `path.isAbsolute(...)` and, if absolute, uses it verbatim — then
   `mkdirSync(recursive: true)` and `writeFileSync` into it. So a `report.build`
   holder can make the server create directories and write files anywhere the
   process can reach. On the Electron deployment that process runs as the
   logged-in Windows user.
2. **The referenced saved report is never ownership-checked.** `savedReportId`
   is taken on faith, so anyone can schedule the recurring execution and export
   of someone else's private (`isShared: false`) saved report.
3. **Every schedule is visible and mutable by every `report.build` holder.**
   `getScheduledReports` returns all rows to any logged-in session, and
   `toggleScheduledReport` / `deleteScheduledReport` accept any id — so one user
   can enumerate, disable, or delete another's schedules.

The file contents themselves are also a concern: the scheduler exports report
data with no permission check at all (it runs as the system), which is why plan
003 wires `sanitizeReportFields` into `src/lib/scheduler.ts`. This plan handles
the path, the ownership, and the enumeration.

## Current state

### `src/app/actions/scheduled-report.ts:9-53` — creation

```ts
export async function createScheduledReport(
  savedReportId: number,
  cron: string,
  format: string,
  recipients: string,
  outputDir: string
) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  if (!cron || !format || !recipients || !outputDir) {
    return { error: "همه فیلدها الزامی هستند." };
  }

  try {
    const report = await prisma.scheduledReport.create({
      data: {
        savedReportId,
        cron: cron.trim(),
        format,
        recipients: recipients.trim(),
        outputDir: outputDir.trim(),
        isActive: true,
      },
      include: { savedReport: true },
    });
```

No validation of `outputDir`, no ownership check on `savedReportId`, no
validation that `cron` parses or that `format` is one of the two supported
values.

### `src/app/actions/scheduled-report.ts:55-67` — unscoped listing

```ts
export async function getScheduledReports() {
  const session = await getSession();
  if (!session) return [];

  try {
    return await prisma.scheduledReport.findMany({
      include: { savedReport: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}
```

No `where` clause at all.

### `src/app/actions/scheduled-report.ts:69-98` and `:100-125` — unscoped mutation

Both `toggleScheduledReport(id, isActive)` and `deleteScheduledReport(id)` check
only `hasPerm(session, "report.build")` and then act on whatever `id` was
passed. Neither verifies the row belongs to the caller.

### `src/lib/scheduler.ts:81-95` — the write

```ts
    // ۳. ایجاد دایرکتوری و ذخیره فایل در مسیر خروجی محلی
    const outputDirectory = path.isAbsolute(sr.outputDir)
      ? sr.outputDir
      : path.join(process.cwd(), sr.outputDir);

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `report-${report.id}-${timestamp}.${ext}`;
    const filePath = path.join(outputDirectory, fileName);

    fs.writeFileSync(filePath, buffer);
```

Note the relative branch is also unsafe: `path.join(process.cwd(), "../../x")`
escapes the working directory just as effectively as an absolute path.

### `src/lib/scheduler.ts:104-127` — recipients are ids only

```ts
    const recipientIds = sr.recipients
      .split(",")
      .map((id: string) => parseInt(id.trim()))
      .filter((id: number) => !isNaN(id));

    const summary = `گزارش دوره‌ای زمان‌بندی‌شده '${report.name}' با موفقیت تولید و در مسیر ${filePath} ذخیره شد.`;

    for (const userId of recipientIds) {
      const notif = await prisma.notification.create({
        data: {
          userId,
          kind: "success",
          title: `گزارش دوره‌ای: ${report.name}`,
          body: summary,
          link: `/reports`,
        },
      });
```

Two things follow from this. First, `recipients` is a comma-separated list of
personnel ids — despite `prisma/schema.prisma:250` documenting it as
"شناسه مخاطبان یا آدرس‌ها" (ids **or** addresses). Second, the notification body
embeds the absolute `filePath`, so the output location is disclosed to every
recipient.

### `prisma/schema.prisma:244-257` — the model

```prisma
model ScheduledReport {
  id            Int         @id @default(autoincrement())
  savedReportId Int
  savedReport   SavedReport @relation(fields: [savedReportId], references: [id], onDelete: Cascade)
  cron          String      // فرمت استاندارد کرون
  format        String      // "excel" | "pdf"
  recipients    String      // شناسه مخاطبان یا آدرس‌ها
  outputDir     String      // دایرکتوری ذخیره فایل‌ها
  isActive      Boolean     @default(true)
  lastRunAt     DateTime?
  createdAt     DateTime    @default(now())

  @@index([savedReportId])
}
```

**There is no `ownerId` on `ScheduledReport`.** Ownership must be derived
through the relation: `ScheduledReport → SavedReport.ownerId`
(`prisma/schema.prisma:79`). That is the pivot this plan uses — no migration
required.

### `prisma/schema.prisma:77-90` — the ownership model to reuse

```prisma
model SavedReport {
  id        Int      @id @default(autoincrement())
  name      String
  ownerId   Int
  isShared  Boolean  @default(false)
  ...
}
```

### The existing access rule for saved reports — the exemplar to match

`src/app/actions/report.ts:50-65` already defines who may see a saved report:

```ts
export async function getSavedReportsAction() {
  const session = await getSession();
  if (!session) return [];

  // نمایش گزارش‌های خود کاربر یا گزارش‌های به اشتراک گذاشته شده
  return prisma.savedReport.findMany({
    where: {
      OR: [
        { ownerId: session.id },
        { isShared: true },
      ],
    },
```

and `src/app/actions/report.ts:68-82` defines who may delete one:

```ts
export async function deleteSavedReportAction(id: number) {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const report = await prisma.savedReport.findUnique({ where: { id } });
  if (!report) return { error: "گزارش یافت نشد." };

  if (report.ownerId !== session.id && session.role !== 1) {
    return { error: "شما مالک این گزارش نیستید و اجازه حذف آن را ندارید." };
  }
```

Match those rules: **read** = own or shared; **mutate** = own (or an
administrator).

### The client's defaults — `src/app/(main)/reports/ReportBuilderClient.tsx:100-101`

```tsx
  const [recipients, setRecipients] = useState(String(userId));
  const [outputDir, setOutputDir] = useState("public/exports/scheduled");
```

The default is already a relative path under the project. The free-text input at
line 1639 is what lets it become anything else.

### The `format` values actually supported — `src/lib/scheduler.ts:73-79`

```ts
    const ext = sr.format === "pdf" ? "pdf" : "xlsx";

    if (sr.format === "pdf") {
      buffer = await generatePDFBuffer(config.entity, config.fields, records);
    } else {
      buffer = await generateExcelBuffer(config.entity, config.fields, records);
    }
```

Anything that is not exactly `"pdf"` silently produces Excel.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |
| Dev run   | `npm run dev`              | serves on :3000     |

## Scope

**In scope** (the only files you should modify or create):
- `src/lib/report-output.ts` (create — the path containment helper)
- `src/app/actions/scheduled-report.ts` — all four actions
- `src/lib/scheduler.ts` — the `runReportTask` output path resolution only
- `src/app/(main)/reports/ReportBuilderClient.tsx` — the `outputDir` input only
- `src/lib/__tests__/report-output.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `prisma/schema.prisma`. Ownership is derivable through `SavedReport.ownerId`;
  adding an `ownerId` column to `ScheduledReport` would need a migration and a
  backfill, and is not necessary for this fix.
- `src/app/actions/report.ts` — its rules are the exemplar, not the target.
- The cron parser (`src/lib/cron.ts` after plan 001, or `src/lib/scheduler.ts`
  before it). Its gaps are documented in plan 001's maintenance notes; this plan
  only validates that an expression has five fields.
- `sanitizeReportFields` wiring into `src/lib/scheduler.ts`. That is plan 003's
  Step 3. If plan 003 has landed you will see it already there — leave it.
- Email delivery for `recipients`. The schema comment promises addresses; the
  code only does ids. That gap is real but it is a feature decision, noted in
  `plans/README.md` under direction, not a security fix.
- The scheduler's 60-second polling loop and its duplicate-run behaviour.

## Git workflow

- Branch: `advisor/007-lock-down-scheduled-reports`
- Plain imperative commit subjects, e.g. `Confine scheduled report output paths`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the path containment helper

Create `src/lib/report-output.ts`:

```ts
import path from "path";

// تمام خروجی‌های زمان‌بندی‌شده باید داخل این پوشه بمانند.
// مسیر مطلق یا خروج از این ریشه پذیرفته نمی‌شود.
export const SCHEDULED_OUTPUT_ROOT = "public/exports/scheduled";

/**
 * ریشه‌ی مطلق پوشه خروجی گزارش‌های زمان‌بندی‌شده
 */
export function scheduledOutputRoot(cwd: string = process.cwd()): string {
  return path.resolve(cwd, SCHEDULED_OUTPUT_ROOT);
}

/**
 * یک مسیر نسبی دلخواه را داخل ریشه‌ی خروجی محدود می‌کند.
 * در صورت مطلق بودن یا خروج از ریشه، null برمی‌گرداند.
 */
export function resolveScheduledOutputDir(
  requested: string,
  cwd: string = process.cwd()
): string | null {
  if (typeof requested !== "string") return null;

  const trimmed = requested.trim();
  if (trimmed === "") return null;

  // مسیرهای مطلق و مسیرهای ویندوزی با حرف درایو مجاز نیستند
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed)) return null;

  // بایت تهی و مسیرهای UNC
  if (trimmed.includes("\0") || trimmed.startsWith("\\\\")) return null;

  const root = scheduledOutputRoot(cwd);
  const resolved = path.resolve(root, trimmed);

  // باید دقیقاً ریشه یا زیرمجموعه‌ی آن باشد
  const relative = path.relative(root, resolved);
  if (relative === "") return root;
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  return resolved;
}
```

Two details that matter and should not be simplified away:

- The check is `path.relative(root, resolved)` starting with `..`, **not** a
  string `startsWith(root)` comparison. A prefix comparison wrongly accepts a
  sibling directory whose name extends the root's (e.g. `.../scheduled-evil`).
- The Windows drive-letter test (`/^[a-zA-Z]:/`) is separate from
  `path.isAbsolute` because on POSIX `path.isAbsolute("C:/x")` is `false`, and
  the tests should pass on either platform.

Also accept the value the UI already defaults to. `ReportBuilderClient` seeds
`outputDir` with the full `"public/exports/scheduled"` string, which resolves
*relative to the root* to `public/exports/scheduled/public/exports/scheduled` —
wrong. Handle it: if `trimmed` equals `SCHEDULED_OUTPUT_ROOT` or starts with
`SCHEDULED_OUTPUT_ROOT + "/"`, strip that prefix before resolving. Step 4
changes the UI to send only a subfolder name, but existing stored rows will
still have the long form.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "path.relative" src/lib/report-output.ts` → present

### Step 2: Validate and scope the four server actions

In `src/app/actions/scheduled-report.ts`:

**2a — a shared ownership helper.** Add a module-private function that resolves
whether the caller may act on a given schedule, mirroring
`src/app/actions/report.ts:75`:

```ts
// دسترسی خواندن: گزارش خود کاربر یا گزارش اشتراکی
// دسترسی تغییر: فقط مالک گزارش یا مدیر سیستم
async function loadScheduleForMutation(id: number, session: Session) {
  const schedule = await prisma.scheduledReport.findUnique({
    where: { id },
    include: { savedReport: true },
  });
  if (!schedule) return { error: "برنامه زمان‌بندی یافت نشد." as const };
  if (schedule.savedReport.ownerId !== session.id && session.role !== 1 && session.role !== 4) {
    return { error: "شما مالک این گزارش نیستید." as const };
  }
  return { schedule };
}
```

Import the `Session` type from `@/lib/auth`.

Note `deleteSavedReportAction` at `src/app/actions/report.ts:75` checks only
`session.role !== 1`, omitting super-admin role 4 — which means a super-admin
cannot delete another user's saved report. That looks like an oversight rather
than intent, so include role 4 here. Do **not** go back and change
`report.ts`; note the inconsistency in your report.

**2b — `createScheduledReport`.** After the permission check, add:

- **ownership of the referenced report**: load
  `prisma.savedReport.findUnique({ where: { savedReportId } })`; return an error
  if missing, or if `ownerId !== session.id && !isShared`
- **format**: accept only `"excel"` or `"pdf"`; reject anything else rather
  than silently defaulting
- **cron**: reject an expression that does not split into at least 5
  whitespace-separated fields — the same precondition `cronMatch` applies at
  `src/lib/scheduler.ts:39-40`
- **recipients**: parse to integer ids and reject if none parse; store the
  normalised comma-joined list rather than the raw string
- **outputDir**: run through `resolveScheduledOutputDir`. If it returns `null`,
  return `{ error: "مسیر خروجی نامعتبر است." }`. **Store the caller's relative
  value, not the resolved absolute path** — resolution must happen at write
  time in the scheduler so the stored row cannot pin an absolute location.

**2c — `getScheduledReports`.** Add a `where` clause scoping to the caller,
matching the read rule for saved reports:

```ts
    return await prisma.scheduledReport.findMany({
      where: {
        savedReport: {
          OR: [{ ownerId: session.id }, { isShared: true }],
        },
      },
      include: { savedReport: true },
      orderBy: { createdAt: "desc" },
    });
```

**2d — `toggleScheduledReport` and `deleteScheduledReport`.** Call
`loadScheduleForMutation` at the top of each and return its error if present.
Keep the existing `audit(...)` calls; they already take `session`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "loadScheduleForMutation" src/app/actions/scheduled-report.ts` → 3
  (declaration plus two call sites)
- `grep -n "resolveScheduledOutputDir" src/app/actions/scheduled-report.ts` → present
- `grep -n "savedReport: {" src/app/actions/scheduled-report.ts` → present in
  `getScheduledReports`

### Step 3: Confine the write in the scheduler

In `src/lib/scheduler.ts`, replace the resolution at lines 82-88:

```ts
    const outputDirectory = path.isAbsolute(sr.outputDir)
      ? sr.outputDir
      : path.join(process.cwd(), sr.outputDir);

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }
```

with:

```ts
    // مسیر ذخیره‌سازی همیشه در زمان اجرا و داخل ریشه‌ی مجاز حل می‌شود،
    // حتی اگر رکورد قدیمی مسیر مطلق ذخیره کرده باشد
    const outputDirectory = resolveScheduledOutputDir(sr.outputDir);
    if (!outputDirectory) {
      console.error(
        `[Scheduler] Refusing to run schedule ${sr.id}: output path is outside the allowed root.`
      );
      return;
    }

    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }
```

This is the load-bearing half of the fix: rows created **before** this plan may
already hold absolute paths, and the action-level validation in Step 2 does not
retroactively clean them. Resolving at write time neutralises them.

Note the early `return` sits inside `runReportTask`'s `try` block; returning
skips `lastRunAt` update and notifications, which is correct — nothing was
produced.

Also consider the notification body at `src/lib/scheduler.ts:109`, which embeds
the absolute `filePath`. Change it to the path relative to
`scheduledOutputRoot()` so a recipient is told where the file is within the
export folder without being handed a filesystem-absolute path:

```ts
    const relativePath = path.relative(scheduledOutputRoot(), filePath);
    const summary = `گزارش دوره‌ای زمان‌بندی‌شده '${report.name}' با موفقیت تولید و در مسیر ${relativePath} ذخیره شد.`;
```

Add the import:

```ts
import { resolveScheduledOutputDir, scheduledOutputRoot } from "@/lib/report-output";
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "path.isAbsolute(sr.outputDir)" src/lib/scheduler.ts` → no matches
- `grep -n "resolveScheduledOutputDir" src/lib/scheduler.ts` → present

### Step 4: Make the UI send a subfolder, not a full path

In `src/app/(main)/reports/ReportBuilderClient.tsx`:

- change the initial state at line 101 from `"public/exports/scheduled"` to
  `""` (meaning "the export root itself")
- change the input at line 1639 so its label and placeholder describe a
  **subfolder name within the export folder**, not a filesystem path. Persian
  label along the lines of: «نام پوشه فرعی (اختیاری) — داخل پوشه خروجی سامانه».

Do not add client-side path validation. The server is the boundary; the UI
change is about not inviting users to type something that will now be rejected.

Touch only those two things in this file. It is 1,666 lines and its size is a
known debt item — do not refactor anything while you are in there.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n 'useState("public/exports/scheduled")' "src/app/(main)/reports/ReportBuilderClient.tsx"` → no matches
- `git diff --stat "src/app/(main)/reports/ReportBuilderClient.tsx"` → a small
  number of changed lines (single digits)

### Step 5: Write the tests

Create `src/lib/__tests__/report-output.test.ts`. Pass an explicit `cwd`
argument to keep the tests independent of where they run — that is why
`resolveScheduledOutputDir` takes one.

Required cases for `resolveScheduledOutputDir`:
- `""` → `null`
- `"   "` → `null`
- `"daily"` → resolves inside the root, and `path.relative(root, result)` is
  `"daily"`
- `"a/b/c"` → resolves inside the root
- `".."` → `null`
- `"../../etc"` → `null`
- `"daily/../../.."` → `null` (normalisation happens before the check)
- An absolute POSIX path (`"/tmp/x"`) → `null`
- A Windows drive path (`"C:/Windows/System32"`) → `null`
- A UNC path (`"\\\\server\\share"`) → `null`
- A string containing a null byte → `null`
- A sibling-prefix path that a naive `startsWith` check would wrongly accept —
  construct it as `"../scheduled-evil"` and assert `null`
- The legacy full-prefix form `"public/exports/scheduled"` → resolves to the
  root itself, not a nested duplicate
- The legacy prefixed subfolder `"public/exports/scheduled/daily"` → resolves
  the same as `"daily"`
- Non-string inputs (`null`, `undefined`, `42`) → `null` without throwing

**Verify**: `npm run test:run` → exit 0, all new cases pass.

### Step 6: Confirm at runtime

Start the dev server (`npm run dev`) and log in as an account with
`report.build`.

1. Save a report, then create a schedule for it with an empty or simple
   subfolder name. Confirm it is created.
2. Attempt to create a schedule with an absolute output path — since the UI no
   longer offers one, call the action directly or temporarily type `../../x`
   into the subfolder field. Confirm the action returns the invalid-path error
   and no row is created.
3. If a second account is available: confirm that account's
   `/reports` page does not list the first account's non-shared schedules, and
   that calling `deleteScheduledReport` with the first account's schedule id
   returns the ownership error.

**Verify**: record each of the three outcomes in your report. If you cannot
obtain a second account, say so rather than marking (3) as passed.

### Step 7: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/report-output.test.ts` — roughly 15 cases per
  Step 5. This is the highest-value test in the plan: path containment is
  exactly the kind of logic that looks right and is not.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, English test
  names.
- `src/lib/report-output.ts` imports only `node:path`, so the test file needs no
  setup.
- The four server actions are not unit-tested — all call Prisma, and this repo
  has no database test harness (plan 001 deferred one). They are verified by the
  runtime checks in Step 6.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f src/lib/report-output.ts` succeeds
- [ ] `grep -n "path.isAbsolute(sr.outputDir)" src/lib/scheduler.ts` returns no matches
- [ ] `grep -n "resolveScheduledOutputDir" src/lib/scheduler.ts src/app/actions/scheduled-report.ts` returns matches in both
- [ ] `grep -c "loadScheduleForMutation" src/app/actions/scheduled-report.ts` returns 3
- [ ] `grep -n "ownerId: session.id" src/app/actions/scheduled-report.ts` returns a match
- [ ] `prisma/schema.prisma` is unmodified: `git diff --name-only` does not list it
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including all path-containment cases
- [ ] `npm run build` exits 0
- [ ] Step 6 outcomes recorded, including which checks could not be run
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
  Note: if plan 003 has landed, `src/lib/scheduler.ts:76-78` will already wrap
  `config.fields` in `sanitizeReportFields`. That is expected, not drift.
- A path-containment test fails in a way you cannot fix without loosening the
  check. Report the input and both values. Never widen the containment rule to
  make a test pass — that is the whole control.
- Scoping `getScheduledReports` empties the `/reports` page for an account that
  legitimately owns schedules. That would mean the `savedReport.ownerId` pivot
  is wrong for some rows — report which, before adjusting the query.
- You find that `ScheduledReport` rows exist whose `savedReport` relation is
  missing. The schema declares `onDelete: Cascade`
  (`prisma/schema.prisma:247`) so this should be impossible; if it is not,
  report before adding null-handling.
- You conclude an `ownerId` column on `ScheduledReport` is necessary. It should
  not be — report why you think so rather than writing a migration.
- Editing `ReportBuilderClient.tsx` turns into more than a handful of lines.

## Maintenance notes

- **The containment rule is enforced at write time in the scheduler, not only at
  create time in the action.** That is deliberate and load-bearing: rows
  predating this plan may hold absolute paths, and the scheduler runs them
  unattended. If someone later "optimises" by resolving the path once at
  creation and storing the absolute result, the protection against legacy rows
  disappears. That is the thing for a reviewer to watch.
- Ownership is derived through `SavedReport.ownerId` because `ScheduledReport`
  has no owner column. If saved reports ever gain co-owners or team sharing,
  every rule in this plan follows automatically — which is the reason for the
  indirection.
- `src/app/actions/report.ts:75` checks `session.role !== 1` and omits role 4,
  so a super-admin currently cannot delete another user's saved report. This
  plan includes role 4 in the new schedule checks, creating a deliberate
  inconsistency with that older line. Worth reconciling as part of the broader
  role→permission migration noted in `plans/README.md`.
- The `recipients` field still accepts only personnel ids while
  `prisma/schema.prisma:250` documents "ids or addresses". The schema comment is
  aspirational; either the comment or the code should change. Flagged as a
  direction item, not fixed here.
- Deferred out of this plan: the scheduler's 60-second polling loop can fire the
  same cron expression more than once within its matching minute, because
  `lastRunAt` is written but never consulted before running. That is a
  correctness bug in its own right and needs its own plan.
