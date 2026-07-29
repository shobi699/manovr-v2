# Plan 015: Resolve React Compiler and Hook Rule Violations in Core UI Components

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- src/app/(main)/reports/ReportBuilderClient.tsx src/components/DataTable.tsx src/components/Sidebar.tsx src/components/SearchableSelect.tsx src/components/NotificationBell.tsx src/components/JalaliDateTimePicker.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

Several core client components call `setState` synchronously within `useEffect` bodies or missing function dependencies in `useMemo`/`useEffect`. Under React 19 and Next.js 16 (Turbopack/React Compiler), synchronous `setState` in effect bodies triggers cascading re-renders, performance degradation, and potential infinite render loops. Fixing these hook rule violations ensures clean reactive flow without unneeded component churn.

## Current state

- `src/app/(main)/reports/ReportBuilderClient.tsx`: `setFilters` and `loadTemplate` are invoked inside `useEffect` bodies synchronously without state derivation or user action boundaries. `handleQuery` is accessed before declaration in effect dependencies.
- `src/components/DataTable.tsx`: `setHiddenCols` and `setCurrentPage` are called synchronously inside `useEffect` bodies when loading saved preferences or resetting pagination.
- `src/components/Sidebar.tsx`: `setIsCollapsed` reads `localStorage` and sets state synchronously inside an effect.
- `src/components/SearchableSelect.tsx`: `setSearch` is called inside `useEffect` on `isOpen` changes.
- `src/components/NotificationBell.tsx`: `fetchNotifs` is invoked synchronously inside `useEffect`.
- `src/components/JalaliDateTimePicker.tsx`: `setSelectedDate` is called synchronously in `useEffect` when parsing `value`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Lint      | `npm run lint`           | exit 0              |
| Tests     | `npm run test:run`       | all 109 tests pass  |

## Scope

**In scope**:
- `src/app/(main)/reports/ReportBuilderClient.tsx`
- `src/components/DataTable.tsx`
- `src/components/Sidebar.tsx`
- `src/components/SearchableSelect.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/JalaliDateTimePicker.tsx`

**Out of scope**:
- Altering visual layout, CSS styles, or user-facing interactions.
- Modifying Server Actions or backend endpoints.

## Git workflow

- Branch: `advisor/015-react-compiler-hook-violations`
- Commit message: `fix(ui): resolve react compiler and hook rule violations in core components`

## Steps

### Step 1: Fix ReportBuilderClient.tsx hook ordering and effect set-state
- Declare `handleQuery` before `useEffect` hooks.
- Derive initial active filter state or use lazy initialization instead of calling `setFilters` inside `useEffect`.
- Wrap `loadTemplate` initial call cleanly without synchronous `setState` in render path.

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 2: Fix DataTable.tsx effect set-state and memo dependencies
- Use lazy state initialization `useState(() => ...)` to read `localStorage` for `hiddenCols` rather than `useEffect` + `setState`.
- Move `setCurrentPage(1)` reset logic into event handlers (search/sort input changes) instead of an effect dependency trigger.
- Add missing `getKey` dependency or memoize `getKey` in `useMemo`.

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 3: Fix Sidebar.tsx, SearchableSelect.tsx, NotificationBell.tsx, and JalaliDateTimePicker.tsx
- In `Sidebar.tsx`: use lazy initializer `useState(() => localStorage.getItem("sidebar_collapsed") === "true")`.
- In `SearchableSelect.tsx`: reset search state when opening dropdown inside trigger click handler.
- In `NotificationBell.tsx`: wrap `fetchNotifs` inside `useEffect` async callback or move setup into channel subscription cleanly.
- In `JalaliDateTimePicker.tsx`: derive date state or use lazy initializer function.

**Verify**: `npx tsc --noEmit` and `npm run lint` -> exit 0.

## Test plan

- Run `npm run test:run` to confirm existing test suite passes.
- Perform manual navigation across `/reports`, `/users`, `/dashboard` to verify tables and sidebars load saved state correctly.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` passes without `react-hooks/set-state-in-effect` errors in target files
- [ ] `npm run test:run` passes
- [ ] `plans/README.md` status row updated

## STOP conditions

- If fixing an effect set-state breaks state synchronization between URL/localStorage and component UI, stop and report back.

## Maintenance notes

- Future component additions should prefer lazy state initialization `useState(() => getInitialState())` over `useEffect` + `setState` for reading external browser storage on mount.
