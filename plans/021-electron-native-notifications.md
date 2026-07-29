# Plan 021: Implement Electron Native System Notifications for SSE Events

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7f79433..HEAD -- main.js src/hooks/useLiveRefresh.ts src/components/NotificationBell.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

The system runs as a desktop application wrapped via Electron (`main.js`). Currently, real-time maneuver updates and notifications are received over SSE (`useLiveRefresh.ts`, `NotificationBell.tsx`) but are only visible when the app window is focused. When dispatchers or operators minimize the application window, critical operational alerts (e.g. new maneuvers or emergency tickets) are missed. Bridging SSE events to Electron native system notifications ensures immediate desktop awareness even when minimized.

## Current state

- `main.js`: Configures Electron `BrowserWindow` and local Next.js server runner. IPC handlers exist for window controls and printer.
- `src/hooks/useLiveRefresh.ts`: Listens to `/api/events` EventSource and triggers `router.refresh()`.
- `src/components/NotificationBell.tsx`: Listens to `/api/events` and updates unread badge counter.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm run test:run`       | all pass            |

## Scope

**In scope**:
- `main.js` (add IPC handler for native OS `Notification`)
- `src/lib/electron-notify.ts` (new helper module for sending desktop notifications)
- `src/hooks/useLiveRefresh.ts`
- `src/components/NotificationBell.tsx`

**Out of scope**:
- Modifying backend SSE broadcasting logic.

## Git workflow

- Branch: `advisor/021-electron-native-notifications`
- Commit message: `feat(desktop): add electron native system notifications for live sse events`

## Steps

### Step 1: Add IPC notification bridge in main.js
- In `main.js`: register `ipcMain.handle("show-notification", (event, { title, body, icon }) => { ... })` using Electron's `Notification` module.
- Ensure notifications work when window is minimized or unfocused.

**Verify**: Electron packaging syntax check -> no errors.

### Step 2: Create src/lib/electron-notify.ts helper
- Create pure helper function `showDesktopNotification(title: string, body: string)` that detects if running inside Electron window (`window.electronAPI` or `window.require("electron")`) or falls back to Web Notification API.

**Verify**: `npx tsc --noEmit` -> no errors.

### Step 3: Connect SSE events to desktop notification helper
- In `useLiveRefresh.ts` and `NotificationBell.tsx`: call `showDesktopNotification` when receiving high-priority maneuver or ticket SSE payloads while the document is hidden (`document.hidden === true`).

**Verify**: `npx tsc --noEmit` and `npm run test:run` -> exit 0.

## Test plan

- Unit test `src/lib/electron-notify.ts` to verify safe fallback behavior in browser environment.
- Manual test in Electron window by triggering an SSE event while window is minimized.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:run` passes
- [ ] Native notification IPC handler registered in `main.js`
- [ ] `plans/README.md` status row updated

## STOP conditions

- If OS notification permissions are denied by Windows security settings, handle gracefully without crashing SSE listener.
