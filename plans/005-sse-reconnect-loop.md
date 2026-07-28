# Plan 005: Stop reopening the SSE connection on every render, and harden the stream

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
- **Category**: bug
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

`useLiveRefresh` opens a Server-Sent Events connection in a `useEffect` whose
dependency array contains a `string[]`. Every one of its four call sites passes
an **inline array literal**, so the array has a new identity on every render.
React compares dependencies by reference, so the effect cleans up and re-runs
on every single render: the `EventSource` is closed and a new one is opened.

That is bad on its own, and it is self-amplifying on this codebase's hot path.
The hook's whole job is to call `router.refresh()` when an event arrives.
`router.refresh()` re-renders. The re-render creates a new array. The new array
tears down the connection that just delivered the event and opens another. On
`/depot`, which also drives a React Three Fiber scene, renders are frequent for
unrelated reasons too.

The consequences: events that arrive during the reconnect window are simply
lost — SSE has no replay — so the live view silently goes stale. On the server,
each open stream registers a listener on a process-global `EventEmitter` whose
default `maxListeners` is 10, and the cleanup path does not fire reliably, so
listeners accumulate and Node starts printing `MaxListenersExceededWarning`.

Two smaller defects in the same subsystem are in scope because fixing the hook
without them just moves the failure: `controller.enqueue` is called inside an
`EventEmitter` handler without a guard, so once a client is gone it throws
inside the emitter's dispatch loop; and the heartbeat and abort paths can both
try to clean up, or neither can.

## Current state

### `src/hooks/useLiveRefresh.ts` in full

```ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useLiveRefresh(channels: string[]) {
  const router = useRouter();

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

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

    return () => {
      eventSource.close();
    };
  }, [channels, router]);
}
```

Line 25 is the bug: `channels` is a `string[]` prop compared by reference.

### The four call sites — all pass inline literals

`src/app/(main)/dashboard/DashboardLiveRefresh.tsx` in full:

```tsx
"use client";

import { useLiveRefresh } from "@/hooks/useLiveRefresh";

export default function DashboardLiveRefresh() {
  useLiveRefresh(["manovr_changed", "train_changed"]);
  return null;
}
```

`src/app/(main)/depot/DepotScene.tsx:188`:

```tsx
  useLiveRefresh(["manovr_changed", "train_changed"]);
```

`src/app/(main)/manovrs/ManovrsTableClient.tsx:45`:

```tsx
}: ManovrsTableClientProps) {
  useLiveRefresh(["manovr_changed"]);
```

`src/app/(main)/manovrs/approvals/ApprovalsPanelClient.tsx:33`:

```tsx
  // فعال‌سازی رفرش زنده صفحه با دریافت اعلان تغییر مانور
  useLiveRefresh(["manovr_changed"]);
```

### The server side — `src/app/api/events/route.ts:13-55`

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

      // ارسال سیگنال heartbeat برای باز نگه داشتن ارتباط
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`);
        } catch {
          // اتصال از سمت کلاینت بسته شده است
          clearInterval(heartbeat);
          sseEmitter.off("message", onMessage);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sseEmitter.off("message", onMessage);
      });
    },
  });
```

Three problems here:

- Line 25 (`controller.enqueue` inside `onMessage`) has no `try`/`catch`. Once
  the client disconnects, enqueueing throws, and it throws *inside* the
  `EventEmitter`'s synchronous dispatch — which aborts delivery to every
  listener registered after it.
- The only reliable cleanup is the `abort` listener at line 41. If it does not
  fire (an abruptly dropped socket, a process-level edge case), the heartbeat's
  `catch` is the fallback — but it only runs every 25 seconds, and only if the
  throw happens there rather than in `onMessage` first.
- There is no `ReadableStream` `cancel` handler, which is the idiomatic place
  for this teardown.

### The emitter — `src/lib/events.ts:1-11`

```ts
import { EventEmitter } from "events";

const globalForEvents = globalThis as unknown as {
  sseEmitter: EventEmitter | undefined;
};

export const sseEmitter = globalForEvents.sseEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.sseEmitter = sseEmitter;
}
```

No `setMaxListeners` call. Node's default is 10, and one listener is registered
per open stream. Note also that the `globalThis` cache is only populated when
`NODE_ENV !== "production"` — in production each module instance gets its own
emitter, which is fine for the single-process Electron deployment
(`main.js:81` forks exactly one server) but is worth knowing.

### Interaction with plan 004

Plan 004 changes what `src/lib/audit.ts:77` puts on the wire and adds a named
`isPersonalChannel` helper to `src/app/api/events/route.ts`. If plan 004 has
already landed, the `onMessage` body you are editing will look slightly
different from the excerpt above — the filter will be extracted into
`isPersonalChannel`. That is expected and is **not** drift. The `enqueue` call
being unguarded is the same either way.

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
- `src/hooks/useLiveRefresh.ts`
- `src/app/api/events/route.ts`
- `src/lib/events.ts`
- `src/lib/__tests__/events-listeners.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- The four call sites. The fix belongs in the hook, not in asking every caller
  to remember `useMemo`. Leave `DashboardLiveRefresh.tsx`, `DepotScene.tsx`,
  `ManovrsTableClient.tsx`, and `ApprovalsPanelClient.tsx` exactly as they are —
  their inline literals must keep working.
- `src/lib/audit.ts` and the emit sites. Plan 004 owns the payload contents.
- The `notification:` filtering logic and the `session.id` comparison.
- Swapping `EventSource` for a library, or introducing a WebSocket. Out of
  proportion to the bug.
- `router.refresh()` call frequency / debouncing. Tempting, but a behaviour
  change — see Maintenance notes.

## Git workflow

- Branch: `advisor/005-sse-reconnect-loop`
- Plain imperative commit subjects, e.g. `Keep the SSE connection across renders`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the hook's effect depend on a stable value

Rewrite `src/hooks/useLiveRefresh.ts` so the effect depends on a primitive
derived from `channels`, and reads the current channel list through a ref. This
keeps the connection open across renders while still honouring a changed
channel list. Target shape:

```ts
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

export function useLiveRefresh(channels: string[]) {
  const router = useRouter();

  // کلید پایدار از روی محتوای آرایه — تا تغییر ارجاع در هر رندر
  // باعث بستن و باز کردن دوباره اتصال SSE نشود
  const channelKey = useMemo(() => [...channels].sort().join("|"), [channels]);

  // آخرین لیست کانال‌ها بدون ایجاد وابستگی در افکت
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.channel && channelsRef.current.includes(payload.channel)) {
          router.refresh();
        }
      } catch {
        // نادیده گرفتن خطاهای پارس داده‌های غیراستاندارد مثل سیگنال اتصال اولیه
      }
    };

    return () => {
      eventSource.close();
    };
  }, [channelKey, router]);
}
```

Three things to get right:

- `channelKey` is a string, compared by value — the effect no longer re-runs on
  every render. The `useMemo` still recomputes each render (its own dep is the
  unstable array), but that is a cheap join, not a socket teardown.
- `channelsRef` is what the message handler reads, so a genuinely changed
  channel list takes effect without needing the effect to re-run.
- `router` from `useRouter()` is stable across renders in the App Router, so
  keeping it in the dep array is correct and costs nothing.

Also drop the `console.log` at the old line 14. It fires on every matched event
on every open page; it is debug output that shipped.

Note `eslint-plugin-react-hooks` may warn that `channels` is used inside the
effect via the ref. It is not a dependency in the meaningful sense — the ref is
read at call time. If the rule fires, silence it at that line with a comment
explaining why, rather than adding `channels` back to the array.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
- `grep -n "console.log" src/hooks/useLiveRefresh.ts` → no matches
- `grep -n "\[channelKey, router\]" src/hooks/useLiveRefresh.ts` → present

### Step 2: Guard every `enqueue` and centralise stream teardown

In `src/app/api/events/route.ts`, restructure the `start` callback so that
cleanup happens once, is idempotent, and every `enqueue` is guarded. Target
shape:

```ts
  const responseStream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // کلاینت قطع شده است — منابع را آزاد کن
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        sseEmitter.off("message", onMessage);
      };

      const onMessage = (event: { channel: string; data: unknown }) => {
        if (isPersonalChannel(event.channel)) {
          const targetUserId = parseInt(event.channel.split(":")[1]) || 0;
          if (targetUserId !== session.id) return;
        }
        send(`data: ${JSON.stringify(event)}\n\n`);
      };

      const heartbeat = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, 25000);

      sseEmitter.on("message", onMessage);
      send(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      // ReadableStream توسط مصرف‌کننده لغو شد
    },
  });
```

Watch the declaration order: `cleanup` references `heartbeat` and `onMessage`,
and `send` references `cleanup`. With `const` arrow functions those are
temporal-dead-zone hazards if any of them *runs* before all three are defined.
The ordering above is safe because nothing executes until
`sseEmitter.on(...)` and the first `send(...)` at the bottom. Do not reorder
those two lines above the declarations.

If plan 004 has landed, `isPersonalChannel` already exists; if not, inline the
`event.channel.startsWith("notification:")` check as it is today. Either way,
do not change the filtering behaviour in this plan.

The `cancel()` handler is a hook for the stream being cancelled by the consumer.
Wire it to `cleanup` if you can do so without restructuring further; if scoping
makes that awkward, leaving it as the documented no-op above is acceptable —
`req.signal` abort is the path that actually fires in Next.js.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "controller.enqueue" src/app/api/events/route.ts` → 1 (only inside `send`)
- `grep -n "closed = true" src/app/api/events/route.ts` → present

### Step 3: Raise the listener ceiling deliberately

In `src/lib/events.ts`, after the emitter is constructed, set an explicit
maximum with a comment recording why:

```ts
export const sseEmitter = globalForEvents.sseEmitter ?? new EventEmitter();

// هر اتصال SSE یک شنونده ثبت می‌کند. سقف پیش‌فرض Node برابر ۱۰ است و برای
// تعداد کاربران همزمان این سامانه کافی نیست. عدد زیر سقف هشدار است، نه محدودیت
// واقعی — اگر در عمل از این هم گذشت، نشانه نشتی شنونده است نه نیاز به افزایش.
sseEmitter.setMaxListeners(64);
```

64 is chosen as comfortably above any plausible concurrent-user count for a
single terminal deployment while still being low enough that a genuine leak
trips the warning. Do not set it to `0` (unlimited) — that would hide exactly
the failure mode this plan is fixing.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "setMaxListeners" src/lib/events.ts` → present

### Step 4: Add a listener-hygiene test

Create `src/lib/__tests__/events-listeners.test.ts`.

Required cases:
- `sseEmitter.getMaxListeners()` returns 64 — the ceiling is set, not left at
  the default 10
- registering and removing N listeners returns `listenerCount("message")` to
  its starting value (a direct assertion that `off` with the same function
  reference works, which is what the route's `cleanup` relies on)
- a listener that throws does not prevent a later-registered listener from
  receiving the event **when** the throwing one is wrapped the way `send` wraps
  it — construct both a guarded and an unguarded handler and show the
  difference. This is the behaviour that motivated Step 2; encoding it stops
  someone unwrapping the `try` later.

Sketch:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { sseEmitter } from "@/lib/events";

afterEach(() => {
  sseEmitter.removeAllListeners("message");
});

describe("sseEmitter listener hygiene", () => {
  it("allows more than Node's default ten listeners", () => {
    expect(sseEmitter.getMaxListeners()).toBe(64);
  });

  it("returns to a clean listener count after off()", () => {
    const before = sseEmitter.listenerCount("message");
    const handler = () => {};
    sseEmitter.on("message", handler);
    expect(sseEmitter.listenerCount("message")).toBe(before + 1);
    sseEmitter.off("message", handler);
    expect(sseEmitter.listenerCount("message")).toBe(before);
  });
});
```

`src/lib/events.ts` imports only `node:events`, so this test is fast and needs
no setup.

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 5: Confirm the connection survives renders

Start the dev server (`npm run dev`), log in, and open `/depot`. Open devtools →
Network, filter to `events`.

**Verify**:
- Exactly **one** `/api/events` request, in a pending/open state.
- Trigger a manovr change from another window (or another tab). The depot view
  refreshes, and the `/api/events` request count stays at **one** — the same
  connection delivers the event and survives the `router.refresh()`.

Before this plan, the request count climbs with every refresh: each
`router.refresh()` closes the stream and opens a new one.

Then check the server console.

**Verify**: no `MaxListenersExceededWarning` appears, even after several
refresh cycles.

If you cannot reproduce the "before" behaviour to compare against, still record
the "after" numbers in your report.

### Step 6: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/events-listeners.test.ts` — 3 cases per Step 4.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001. Note the `afterEach` removing all `"message"` listeners: `sseEmitter` is
  a module-level singleton shared across test files, so without cleanup the
  listener-count assertions become order-dependent and flaky.
- **`useLiveRefresh` itself is not unit-tested.** Doing so needs a DOM
  environment, an `EventSource` polyfill, and a mocked `next/navigation` router
  — three pieces of infrastructure this repo does not have, and plan 001
  deliberately configured Vitest with `environment: "node"`. The hook is
  verified by the runtime check in Step 5. Say so in your report rather than
  quietly skipping it.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "\[channels, router\]" src/hooks/useLiveRefresh.ts` returns no matches
- [ ] `grep -n "\[channelKey, router\]" src/hooks/useLiveRefresh.ts` returns a match
- [ ] `grep -n "console.log" src/hooks/useLiveRefresh.ts` returns no matches
- [ ] `grep -c "controller.enqueue" src/app/api/events/route.ts` returns 1
- [ ] `grep -n "setMaxListeners(64)" src/lib/events.ts` returns a match
- [ ] The four call sites are unmodified:
      `git diff --name-only` does not list `DashboardLiveRefresh.tsx`,
      `DepotScene.tsx`, `ManovrsTableClient.tsx`, or `ApprovalsPanelClient.tsx`
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new listener-hygiene cases
- [ ] `npm run build` exits 0
- [ ] Step 5 recorded: exactly one `/api/events` connection, surviving refreshes,
      no `MaxListenersExceededWarning`
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file —
  **except** the `onMessage` filter body, which plan 004 legitimately changes.
- After Step 1, live refresh stops working entirely. The likely cause is the
  ref not being updated before the effect's handler reads it; report the
  symptom rather than adding `channels` back to the dependency array, which
  would restore the original bug.
- The runtime check in Step 5 still shows the connection count climbing. Do not
  start debouncing `router.refresh()` to mask it — report what you observe.
- Restructuring the `start` callback in Step 2 produces a temporal-dead-zone
  error at runtime (`Cannot access 'cleanup' before initialization`). That means
  something executes earlier than the excerpt assumes; report the stack.
- You find a fifth caller of `useLiveRefresh`. Search:
  `grep -rn "useLiveRefresh(" src/ | grep -v hooks/useLiveRefresh`. Four are
  expected. A fifth may pass a non-literal that behaves differently.
- You are tempted to change `router.refresh()` semantics, add debouncing, or
  switch transport. All are out of scope.

## Maintenance notes

- **The invariant to protect: `useLiveRefresh`'s effect must never depend on a
  value with unstable identity.** The `channelKey` join exists solely for that.
  If someone "simplifies" it back to `[channels, router]`, the reconnect loop
  returns and it will not be obvious from a code review — it only shows up as a
  climbing connection count in devtools. That is the thing to watch in review.
- Callers may keep passing inline array literals. That is deliberate: the hook
  absorbs the instability so four call sites do not each have to remember
  `useMemo`. Do not "fix" the call sites.
- `router.refresh()` fires once per matching event with no coalescing. If a
  bulk operation emits many events at once (`bulkUpdateTrainStatus` in
  `src/app/actions/train.ts:291` calls `audit` per record), that is a burst of
  refreshes. Debouncing would help but changes perceived latency — it deserves
  its own decision, not a drive-by change here.
- The `globalThis` emitter cache in `src/lib/events.ts:9-11` is only populated
  outside production. In the packaged Electron app there is exactly one server
  process (`main.js:81`), so a single emitter instance is guaranteed anyway. If
  this ever runs multi-process or multi-instance, SSE fan-out stops working
  across processes and needs a real broker — a redesign, not a patch.
- Deferred out of this plan: unit-testing the hook itself. That needs
  `environment: "jsdom"`, an `EventSource` stub, and a `next/navigation` mock.
  Worth doing if more client-side hooks appear; not worth it for one.
