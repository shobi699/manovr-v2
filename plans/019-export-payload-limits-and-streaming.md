# Plan 019: Add Payload Limits and Streaming Guards to Excel & PDF Export APIs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- src/app/api/export/excel/route.ts src/app/api/export/pdf/route.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

The export API routes (`/api/export/excel` and `/api/export/pdf`) fetch all matching maneuver records directly into memory using `prisma.manovr.findMany()`. If a user exports historical maneuvers across multiple years without filters, fetching tens of thousands of nested relation objects simultaneously causes high memory allocation spikes and risks Node.js heap exhaustion or server process crashes. Capping maximum export rows and applying chunked batching ensures server stability.

## Current state

- `src/app/api/export/excel/route.ts`: Executes unbounded `prisma.manovr.findMany({ where, include: { ... } })` and serializes the complete array into ExcelJS buffer.
- `src/app/api/export/pdf/route.ts`: Executes unbounded `prisma.manovr.findMany({ where, include: { ... } })` and renders a full PDF table in memory.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm run test:run`       | all pass            |

## Scope

**In scope**:
- `src/app/api/export/excel/route.ts`
- `src/app/api/export/pdf/route.ts`
- `src/lib/export-helpers.ts`

**Out of scope**:
- Database schema changes.

## Git workflow

- Branch: `advisor/019-export-payload-limits-and-streaming`
- Commit message: `perf(export): enforce maximum record cap and batching on export routes`

## Steps

### Step 1: Define MAX_EXPORT_RECORDS constant and query guard
- Define `MAX_EXPORT_RECORDS = 5000` cap in `src/lib/export-helpers.ts`.
- In `/api/export/excel/route.ts` and `/api/export/pdf/route.ts`: execute `prisma.manovr.count({ where })` first.
- If count exceeds `MAX_EXPORT_RECORDS`, return HTTP 400 with Persian error message advising user to refine date/filter criteria.

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 2: Implement batch fetching for database queries
- When record count is within limits, fetch records in batches of `1000` using `take` and `skip` to reduce peak memory heap allocation during object instantiation.

**Verify**: `npx tsc --noEmit` and `npm run test:run` -> exit 0.

## Test plan

- Add unit test verifying `MAX_EXPORT_RECORDS` guard constant and error handling behavior.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:run` passes
- [ ] Record count check precedes export generation in route handlers
- [ ] `plans/README.md` status row updated

## STOP conditions

- If `MAX_EXPORT_RECORDS` limits legitimate administrative reports, make the limit configurable via `settings.ts` or system config.
