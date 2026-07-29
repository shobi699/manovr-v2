# Plan 020: Add Integration Tests for Critical Server Actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- src/app/actions/user.ts src/app/actions/manovr.ts src/app/actions/role.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/014-audit-coverage-user-role-line.md, plans/016-bulk-user-action-guards.md
- **Category**: tests
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

The test suite currently contains 16 test files (109 unit tests) covering `src/lib/` pure utility functions (`audit`, `branding`, `list-query`, `bulk-guards`, `perms`, `report-output`, etc.). However, Server Actions under `src/app/actions/` (`user.ts`, `manovr.ts`, `role.ts`) execute critical state mutations, permission verification, and audit logging. Adding mock-backed integration tests for Server Actions ensures authorization checks and business logic rules remain protected against regression.

## Current state

- `src/lib/__tests__/`: Contains unit tests for pure library functions.
- `src/app/actions/user.ts`: Handles user CRUD and bulk shift/position/delete operations.
- `src/app/actions/manovr.ts`: Handles atomic maneuver creation and confirmation workflow.
- `src/app/actions/role.ts`: Handles permission matrix updates and role deletion.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm run test:run`       | all pass            |

## Scope

**In scope**:
- `src/app/actions/__tests__/user-actions.test.ts` (new)
- `src/app/actions/__tests__/manovr-actions.test.ts` (new)
- `src/app/actions/__tests__/role-actions.test.ts` (new)

**Out of scope**:
- Modifying production action implementations unless a test reveals a bug.

## Git workflow

- Branch: `advisor/020-server-actions-integration-tests`
- Commit message: `test(actions): add integration tests for user, manovr, and role server actions`

## Steps

### Step 1: Create mock session & prisma test helpers
- Create test utility helpers to mock `getSession()` and Prisma database client calls cleanly in Vitest environment.

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 2: Add integration tests for user actions
- Create `src/app/actions/__tests__/user-actions.test.ts`.
- Test permission check refusal when session is missing or lacks `user.manage`.
- Test role-hierarchy enforcement on bulk user update/delete actions.

**Verify**: `npm run test:run` -> new tests pass.

### Step 3: Add integration tests for manovr & role actions
- Create `src/app/actions/__tests__/manovr-actions.test.ts` and `role-actions.test.ts`.
- Test line capacity restriction on manovr creation.
- Test system role protection on role deletion.

**Verify**: `npm run test:run` -> all tests pass.

## Test plan

- Execute `npm run test:run` and verify test suite expands cleanly with all new integration test cases passing.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:run` passes with new server action integration tests
- [ ] `plans/README.md` status row updated

## STOP conditions

- If mocking Next.js `revalidatePath` or `redirect` causes test runner errors, mock `next/cache` and `next/navigation` modules at top of test files.
