# Plan 022: Implement Background Report Queue for Heavy PDF/Excel Generation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- src/lib/scheduler.ts src/app/actions/scheduled-report.ts src/lib/report-output.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/007-lock-down-scheduled-reports.md
- **Category**: direction
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

Currently, scheduled reports and heavy report exports are processed synchronously on the main Node.js event loop during scheduled cron triggers (`scheduler.ts`) or user API invocations. Generating large PDF files using `pdfmake` and complex Excel workbooks using `exceljs` blocks event loop responsiveness. Implementing an async background report queue decouples heavy rendering from UI request processing.

## Current state

- `src/lib/scheduler.ts`: Initializes scheduled report cron timers and triggers generation directly inside timer callback.
- `src/app/actions/scheduled-report.ts`: Manages schedule configuration records in SQLite.
- `src/lib/report-output.ts`: Handles file path containment and directory creation for generated outputs.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm run test:run`       | all pass            |

## Scope

**In scope**:
- `src/lib/report-queue.ts` (new background task queue helper)
- `src/lib/__tests__/report-queue.test.ts` (new unit tests)
- `src/lib/scheduler.ts`
- `src/app/actions/scheduled-report.ts`

**Out of scope**:
- Database schema changes (queue items held in memory/file-state).

## Git workflow

- Branch: `advisor/022-background-report-queue`
- Commit message: `feat(reports): implement async background report processing queue`

## Steps

### Step 1: Create src/lib/report-queue.ts background queue
- Create `ReportQueue` class with task concurrency limit (`concurrency: 1`), job status tracking (`pending`, `processing`, `completed`, `failed`), and event listener callbacks.
- Add unit tests in `src/lib/__tests__/report-queue.test.ts`.

**Verify**: `npm run test:run` -> new queue unit tests pass.

### Step 2: Integrate report queue with scheduler.ts
- Modify `scheduler.ts` so cron triggers enqueue report generation jobs into `ReportQueue` instead of blocking synchronous execution.
- Record execution logs and status updates upon job completion or failure.

**Verify**: `npx tsc --noEmit` and `npm run test:run` -> exit 0.

## Test plan

- Unit tests in `src/lib/__tests__/report-queue.test.ts` verifying concurrency limit, task ordering, and failure retry handling.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:run` passes with new report queue unit tests
- [ ] Cron report triggers decoupled into background queue
- [ ] `plans/README.md` status row updated

## STOP conditions

- If an error occurs during queue execution, ensure directory permissions and error status are logged to `AuditLog` or file logger without throwing uncaught exceptions.
