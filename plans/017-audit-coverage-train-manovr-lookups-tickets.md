# Plan 017: Expand Audit Log Coverage to Train, Maneuver, Lookup, and Ticket Server Actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- src/app/actions/train.ts src/app/actions/manovr.ts src/app/actions/lookups.ts src/app/actions/tickets.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/014-audit-coverage-user-role-line.md
- **Category**: security
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

Plan 014 established audit logging for user, role, and line management actions using `audit()` and pure Persian summaries (`src/lib/audit-summaries.ts`). However, critical operational domain actions for trains (`train.ts`), maneuvers (`manovr.ts`), lookup values (`lookups.ts`), and support tickets (`tickets.ts`) currently mutate records without emitting audit logs. Adding structured audit calls ensures full administrative accountability across the system.

## Current state

- `src/lib/audit-summaries.ts`: Contains pure summary helpers for `personnel`, `role`, and `line`.
- `src/app/actions/train.ts`: Actions (`createTrain`, `updateTrain`, `deleteTrain`, `bulkDeleteTrains`, `toggleTrainActive`) execute Prisma writes without `audit()`.
- `src/app/actions/manovr.ts`: Actions (`createManovr`, `updateManovrStatus`, `updateConfirmStatus`) execute Prisma writes without `audit()`.
- `src/app/actions/lookups.ts`: Actions (`saveLookupValue`, `deleteLookupValue`, `toggleLookupActive`) execute Prisma writes without `audit()`.
- `src/app/actions/tickets.ts`: Actions (`createTicket`, `replyTicket`, `updateTicketStatus`) execute Prisma writes without `audit()`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm run test:run`       | all pass            |

## Scope

**In scope**:
- `src/lib/audit-summaries.ts` (add summary formatters for train, manovr, lookup, ticket)
- `src/lib/__tests__/audit-summaries.test.ts` (add unit tests for new summary formatters)
- `src/app/actions/train.ts`
- `src/app/actions/manovr.ts`
- `src/app/actions/lookups.ts`
- `src/app/actions/tickets.ts`

**Out of scope**:
- `src/lib/audit.ts` core engine (already verified in Plan 013).
- Client-side UI components.

## Git workflow

- Branch: `advisor/017-audit-coverage-train-manovr-lookups-tickets`
- Commit message: `feat(audit): add audit log coverage to train, manovr, lookup, and ticket actions`

## Steps

### Step 1: Add summary formatters in audit-summaries.ts & unit tests
- Add `trainCreatedSummary`, `trainUpdatedSummary`, `trainDeletedSummary`.
- Add `manovrCreatedSummary`, `manovrStatusUpdatedSummary`.
- Add `lookupSavedSummary`, `lookupDeletedSummary`.
- Add `ticketCreatedSummary`, `ticketRepliedSummary`.
- Add unit tests in `src/lib/__tests__/audit-summaries.test.ts`.

**Verify**: `npm run test:run` -> all tests pass.

### Step 2: Add audit calls to train.ts & manovr.ts
- In `src/app/actions/train.ts`: add `audit()` calls BEFORE revalidation or redirect in `createTrain`, `updateTrain`, `deleteTrain`, `bulkDeleteTrains`, `toggleTrainActive`.
- In `src/app/actions/manovr.ts`: add `audit()` calls in `createManovr`, `updateManovrStatus`, `updateConfirmStatus`.

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 3: Add audit calls to lookups.ts & tickets.ts
- In `src/app/actions/lookups.ts`: add `audit()` calls in `saveLookupValue`, `deleteLookupValue`, `toggleLookupActive`.
- In `src/app/actions/tickets.ts`: add `audit()` calls in `createTicket`, `replyTicket`, `updateTicketStatus`.

**Verify**: `npx tsc --noEmit` and `npm run test:run` -> exit 0.

## Test plan

- Unit tests in `src/lib/__tests__/audit-summaries.test.ts` to verify Persian summary output strings.
- Verify `audit()` calls compile cleanly and accept valid entity parameters.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:run` passes with new summary tests
- [ ] `audit()` calls present across `train.ts`, `manovr.ts`, `lookups.ts`, `tickets.ts`
- [ ] `plans/README.md` status row updated

## STOP conditions

- If an action uses Next.js `redirect()`, `audit()` MUST be called before `redirect()` to avoid swallowed control flow exceptions.
