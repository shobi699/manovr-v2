# Plan 004: Stop broadcasting audit-log diffs to every connected client

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
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: security
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

Every audited mutation in this system — user edits, role changes, branding
changes, backups, manovr approvals — writes an `AuditLog` row and then pushes
that entire row over Server-Sent Events to **every** connected browser.

The audit log is meant to be privileged: `src/lib/perms.ts:25` defines
`"audit.view"` — "مشاهده لاگ وقایع و عملیات کاربران" — and
`src/app/(main)/admin/audit/` is the gated page for reading it. But the SSE
endpoint applies no permission check at all beyond "is logged in", and filters
only the personal-notification channels. So a user with role 0 and no
permissions, sitting on `/depot` with the live-refresh hook running, receives a
running feed of who changed whose username, which roles moved, and what the
system announcement now says.

The clients do not even want this data. The only consumer of these events is
`useLiveRefresh`, which reads exactly one field — `payload.channel` — and calls
`router.refresh()`. The entire payload beyond the channel name is unused by
every subscriber in the codebase.

The fix is therefore small and low-risk: stop putting privileged data on a
channel nobody reads it from.

## Current state

### The emitter — `src/lib/events.ts` in full

```ts
import { EventEmitter } from "events";

const globalForEvents = globalThis as unknown as {
  sseEmitter: EventEmitter | undefined;
};

export const sseEmitter = globalForEvents.sseEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.sseEmitter = sseEmitter;
}

// کانال‌ها و رویدادهای تعریف شده
export const EventChannels = {
  MANOVR_CHANGED: "manovr_changed",
  TRAIN_CHANGED: "train_changed",
  DEPOT_CHANGED: "depot_changed",
  NOTIFICATION_PREFIX: "notification:",
};

// انتشار یک رویداد به استریم SSE
export function emitSSEEvent(channel: string, data: any) {
  sseEmitter.emit("message", { channel, data });
}
```

### The leak — `src/lib/audit.ts:59-83`

```ts
  try {
    // ۱. ثبت در جدول AuditLog
    const log = await prisma.auditLog.create({
      data: {
        actorId,
        actorName,
        entity,
        entityId,
        action,
        changes: changesJson,
        summary,
      },
    });

    // ۲. تولید اعلان‌های خودکار
    await handleAutoNotifications(session, entity, entityId, action, before, after, summary);

    // ۳. انتشار رویداد به استریم SSE
    emitSSEEvent(`${entity}_changed`, { id: entityId, action, summary, log });

    return log;
  } catch (error) {
    console.error("Audit logger failed:", error);
  }
```

Line 77 puts the whole `log` row on the wire. `log.changes` is the serialized
field-level diff produced by `computeDiff` (`src/lib/audit.ts:42-43`);
`log.summary` is a human-readable Persian sentence naming the actor and what
changed; `log.actorName` and `log.actorId` identify who did it.

`computeDiff` (`src/lib/audit.ts:11`) does exclude `passwordHash` — verified,
and plan 001 adds a regression test for it — so hashes are not in this payload.
Everything else about the change is.

### The unfiltered fan-out — `src/app/api/events/route.ts:13-46`

```ts
  const responseStream = new ReadableStream({
    start(controller) {
      // ارسال سیگنال اولیه اتصال
      controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      const onMessage = (event: { channel: string; data: any }) => {
        // مدیریت ارسال اعلان‌های شخصی یا عمومی
        if (event.channel.startsWith("notification:")) {
          const targetUserId = parseInt(event.channel.split(":")[1]) || 0;
          if (targetUserId !== session.id) return;
        }

        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      sseEmitter.on("message", onMessage);
```

Only `notification:` channels are scoped to a user. Everything else falls
through to the `enqueue` and reaches every stream.

The route's own gate is `src/app/api/events/route.ts:8-11`:

```ts
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
```

### The only consumer — `src/hooks/useLiveRefresh.ts:10-20`

```ts
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.channel && channels.includes(payload.channel)) {
          console.log(`[SSE Live] Channel ${payload.channel} triggered page refresh.`);
          router.refresh();
        }
      } catch (err) {
        // نادیده گرفتن خطاهای پارس داده‌های غیراستاندارد مثل سیگنال اتصال اولیه
      }
    };
```

`payload.data` is never read **by `useLiveRefresh`**. Confirm the wider picture
before you change anything:

```bash
grep -rn "payload.data" src/
```

Expected: exactly one match, `src/components/Sidebar.tsx:52`:

```tsx
          const accentColor = payload.data.accentColor || "#d8842a";
          document.documentElement.style.setProperty("--accent", accentColor, "important");
```

That is the `branding_changed` channel, which this plan does **not** change —
so it keeps working. No consumer reads the `log` object out of an
`` `${entity}_changed` `` payload. If the grep returns anything other than that
single Sidebar match, treat it as a STOP condition.

### The other emit sites — what each currently sends

| Site | Channel | Payload today |
|---|---|---|
| `src/lib/audit.ts:77` | `` `${entity}_changed` `` | `{ id, action, summary, log }` — **the leak** |
| `src/lib/audit.ts:120-123` | `` `notification:${n.userId}` `` | `{ type, notification }` — already user-scoped |
| `src/lib/audit.ts:143-146` | `` `notification:${creatorId}` `` | `{ type, notification }` — already user-scoped |
| `src/app/actions/lookups.ts:189` | `branding_changed` | the full branding settings object |
| `src/lib/scheduler.ts:123-126` | `` `notification:${userId}` `` | `{ type, notification }` — already user-scoped |

`branding_changed` carries the title, footer, logo, accent colour and
announcement text — all of which every user sees rendered anyway
(`src/app/layout.tsx:41-47`, `src/app/(main)/layout.tsx:22-42`). It is not
sensitive and is left alone by this plan. **It also has a live consumer**:
`src/components/Sidebar.tsx:47-55` reads `payload.data.accentColor` off it to
repaint the theme without a reload. Changing that payload would break the
feature; do not touch it.

The `notification:` payloads are correctly scoped and stay as they are.

### The channel names in use

`useLiveRefresh` is called with these channel sets — all four call sites:

- `src/app/(main)/dashboard/DashboardLiveRefresh.tsx:6` — `["manovr_changed", "train_changed"]`
- `src/app/(main)/depot/DepotScene.tsx:188` — `["manovr_changed", "train_changed"]`
- `src/app/(main)/manovrs/ManovrsTableClient.tsx:45` — `["manovr_changed"]`
- `src/app/(main)/manovrs/approvals/ApprovalsPanelClient.tsx:33` — `["manovr_changed"]`

Because the channel is built as `` `${entity}_changed` `` from the `entity`
argument to `audit()`, other channels are also emitted today —
`personnel_changed`, `train_changed`, `line_changed`, `branding_changed`,
`backup_changed`, `scheduledReport_changed`, `ticket_changed` — but nothing
subscribes to them. They still reach every client, which is the problem.

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
- `src/lib/audit.ts` — the emit at line 77 only
- `src/app/api/events/route.ts` — the `onMessage` filter
- `src/lib/events.ts` — add a typed payload shape
- `src/lib/__tests__/sse-payload.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/hooks/useLiveRefresh.ts` — its reconnect bug is plan 005. Do not fix it
  here, and do not change the shape it parses (`payload.channel` must keep
  working exactly as it does today).
- The `notification:` emit sites (`src/lib/audit.ts:120`, `:143`,
  `src/lib/scheduler.ts:123`). Already scoped; leave them.
- `src/app/actions/lookups.ts:189` (`branding_changed`). Not sensitive.
- `computeDiff` and the `AuditLog` table itself. The audit *record* should keep
  everything it records today; only the broadcast changes.
- The `src/app/(main)/admin/audit/` page. It reads from the database with a
  proper gate and is unaffected.
- Adding new permission checks to unrelated routes.

## Git workflow

- Branch: `advisor/004-scope-sse-events`
- Plain imperative commit subjects, e.g. `Emit only channel names over SSE`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Give the SSE payload a declared shape

In `src/lib/events.ts`, add an exported type above `emitSSEEvent` describing
what a broadcast event may contain, and narrow `emitSSEEvent`'s signature to it:

```ts
/**
 * محتوای مجاز رویدادهای عمومی SSE.
 * فقط سیگنال ابطال کش — هیچ داده‌ی محرمانه‌ای نباید اینجا قرار گیرد.
 * مصرف‌کننده (useLiveRefresh) تنها فیلد channel را می‌خواند.
 */
export interface SSEBroadcast {
  /** شناسه رکورد تغییر یافته — برای ابطال هدفمند کش در آینده */
  id?: number;
  /** نوع عملیات: CREATE | UPDATE | DELETE | CONFIRM */
  action?: string;
}
```

Keep `emitSSEEvent(channel: string, data: any)` as-is for now — the
`notification:` and `branding_changed` callers pass richer objects and are out
of scope. Instead add a second, narrower export that the audit path will use:

```ts
// انتشار سیگنال عمومی تغییر — بدون هیچ داده‌ی محرمانه
export function emitEntityChanged(entity: string, payload: SSEBroadcast) {
  sseEmitter.emit("message", { channel: `${entity}_changed`, data: payload });
}
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "emitEntityChanged" src/lib/events.ts` → present

### Step 2: Strip the audit log out of the broadcast

In `src/lib/audit.ts`, replace line 77:

```ts
    emitSSEEvent(`${entity}_changed`, { id: entityId, action, summary, log });
```

with:

```ts
    // فقط سیگنال ابطال — خلاصه و دیف لاگ محرمانه است و نباید همگانی منتشر شود
    emitEntityChanged(entity, { id: entityId, action });
```

Update the import at `src/lib/audit.ts:3` to bring in `emitEntityChanged`
alongside `emitSSEEvent` (which is still used at lines 120 and 143 for the
notification channels).

The function must still `return log;` at line 79 — the return value is the
database row, unrelated to the broadcast.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "summary, log }" src/lib/audit.ts` → no matches
- `grep -n "emitEntityChanged" src/lib/audit.ts` → exactly one match
- `grep -cn "emitSSEEvent" src/lib/audit.ts` → 2 (the two notification sites)

### Step 3: Make the stream filter explicit and default-deny

In `src/app/api/events/route.ts`, rewrite `onMessage` so the routing decision is
stated positively rather than as a single special case. Target shape:

```ts
      // کانال‌های عمومی مجاز — فقط سیگنال ابطال کش، بدون داده‌ی محرمانه
      const isPersonalChannel = (channel: string) => channel.startsWith("notification:");

      const onMessage = (event: { channel: string; data: unknown }) => {
        if (isPersonalChannel(event.channel)) {
          const targetUserId = parseInt(event.channel.split(":")[1]) || 0;
          if (targetUserId !== session.id) return;
        }
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };
```

Behaviourally this is what the code already does; the point is that after
Step 2 the non-personal channels carry nothing worth withholding, and the
comment records why. Keep the `session.id` comparison exactly as it is.

Do **not** add per-connection permission checks here. That would require
resolving permissions at stream open and re-resolving them when roles change,
and it is unnecessary once the payload is just a channel name. If a future
change puts privileged data back on a public channel, that is when a permission
gate becomes the right answer — note it in the comment.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "isPersonalChannel" src/app/api/events/route.ts` → present

### Step 4: Add a regression test

Create `src/lib/__tests__/sse-payload.test.ts`. Test the emitter contract
directly by subscribing to `sseEmitter` and asserting on what
`emitEntityChanged` puts on it.

Required cases:
- `emitEntityChanged("manovr", { id: 7, action: "CREATE" })` emits a `"message"`
  event whose `channel` is `"manovr_changed"`
- the emitted `data` has **only** the keys `id` and `action` — assert with
  `expect(Object.keys(received.data).sort()).toEqual(["action", "id"])`
- the emitted payload, once `JSON.stringify`'d, contains no `summary`,
  `changes`, `actorName`, or `actorId` substring

Sketch:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { sseEmitter, emitEntityChanged } from "@/lib/events";

afterEach(() => {
  sseEmitter.removeAllListeners("message");
});

describe("emitEntityChanged", () => {
  it("emits only the channel signal, never audit detail", () => {
    const received: unknown[] = [];
    sseEmitter.on("message", (e) => received.push(e));

    emitEntityChanged("personnel", { id: 3, action: "UPDATE" });

    expect(received).toHaveLength(1);
    const serialized = JSON.stringify(received[0]);
    for (const forbidden of ["summary", "changes", "actorName", "actorId"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
```

`src/lib/events.ts` imports only `node:events` — no Prisma, no Next internals —
so this test is fast and has no setup requirements.

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 5: Confirm at runtime that live refresh still works

Start the dev server (`npm run dev`) and, in two browser windows:

1. Open `/manovrs` in window A.
2. In window B, create or confirm a manovr.
3. Window A should refresh its list without a manual reload.

Then open devtools in window A, find the `/api/events` request in the Network
tab, and read the event stream.

**Verify**:
- Window A's list updates — the live-refresh behaviour is unchanged.
- The `manovr_changed` frames in the stream contain only `channel`, `id`, and
  `action`. No Persian summary sentence, no `changes` JSON, no actor name.
  Before this plan, each frame carried all of them.

If you cannot run two sessions, at minimum confirm the second point with a
single window by triggering a mutation and reading the stream.

### Step 6: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/sse-payload.test.ts` — 2–3 cases covering the
  channel name, the exact key set, and the absence of audit fields in the
  serialized payload.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, English test
  names. Note the `afterEach` cleanup: `sseEmitter` is a module-level singleton,
  so listeners must be removed between cases or they accumulate across tests.
- The runtime check in Step 5 is manual; there is no integration harness in this
  repo. Record its result in your report.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "summary, log }" src/lib/audit.ts` returns no matches
- [ ] `grep -c "emitEntityChanged" src/lib/audit.ts` returns 1
- [ ] `grep -c "emitSSEEvent" src/lib/audit.ts` returns 2 (both notification sites)
- [ ] `grep -n "emitEntityChanged" src/lib/events.ts` returns a match
- [ ] `grep -n "isPersonalChannel" src/app/api/events/route.ts` returns a match
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new SSE payload cases
- [ ] `npm run build` exits 0
- [ ] Step 5 recorded: live refresh still fires, and stream frames carry no
      audit summary or diff
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- The `grep -rn "payload.data" src/` check in "Current state" returns anything
  beyond the single `src/components/Sidebar.tsx:52` match. That would mean
  something depends on the data being removed — report which component and what
  it reads before changing anything.
- Live refresh stops working after Step 2. The channel name is the only thing
  `useLiveRefresh` matches on (`src/hooks/useLiveRefresh.ts:13`), so a break
  here means the channel string changed — check that `emitEntityChanged` builds
  `` `${entity}_changed` `` identically to the old inline template.
- You find yourself adding a permission lookup inside the `ReadableStream`
  `start` callback. That is out of scope and has a re-evaluation problem this
  plan deliberately avoids — report instead.
- You are tempted to also fix the reconnect loop in `useLiveRefresh` or the
  unguarded `controller.enqueue`. Both are plan 005. Leave them.

## Maintenance notes

- **The rule this plan establishes: public SSE channels carry a channel name and
  an id, nothing else.** `emitEntityChanged`'s doc comment says so. Any future
  change that puts a record, a diff, or a message body on a non-`notification:`
  channel reintroduces this finding — that is the thing for a reviewer to watch.
- If someone later wants richer live updates (say, patching a row in place
  instead of a full `router.refresh()`), the right shape is a per-connection
  permission check resolved at stream open plus re-resolution on role change —
  not widening the broadcast. That is a design decision, not a chore.
- `src/app/api/events/route.ts` still leaks server-side listeners in some
  disconnect paths and hits Node's default `maxListeners` of 10 with more than
  ten concurrent clients. Plan 005 addresses both; this plan deliberately does
  not touch them.
- The `EventChannels` constant in `src/lib/events.ts:14-19` is declared but
  unused — every emit site builds its channel string inline. Worth consolidating
  someday; not worth a plan on its own.
