# Plan 008: Require a permission before writing the shared dashboard layouts

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

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

`saveDashboardLayoutAction` takes the layout scope as a **caller-supplied
parameter** and gates on nothing but "is logged in". The three scopes are not
equivalent:

- `"user"` writes the caller's own layout. Correct — anyone may rearrange their
  own dashboard.
- `"role"` writes the row shared by everyone holding the caller's numeric role.
- `"default"` writes the single fallback row that `getDashboardLayout` serves to
  **every user** who has no personal and no role layout — which is most users,
  most of the time.

So any authenticated account, including one with role 0 and no permissions, can
call the action with `scope: "default"` and replace the dashboard that everyone
else sees. Nothing in the UI offers that, but a server action is a network
endpoint: the argument is whatever the caller sends.

This is not a data-exfiltration bug — no one reads anything they shouldn't. It
is an integrity bug: one low-privilege user can degrade the dashboard for the
whole terminal, and there is no audit record of it having happened.

## Current state

### `src/app/actions/dashboard.ts` in full

```ts
"use server";

// Trigger TS server reload
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getDashboardLayout() {
  const session = await getSession();
  if (!session) return null;

  try {
    // ۱. بررسی چیدمان شخصی کاربر
    let layout = await prisma.dashboardLayout.findFirst({
      where: { scope: "user", userId: session.id },
    });

    // ۲. بررسی چیدمان نقش در صورت عدم وجود چیدمان شخصی
    if (!layout) {
      layout = await prisma.dashboardLayout.findFirst({
        where: { scope: "role", roleId: session.role },
      });
    }

    // ۳. بررسی چیدمان پیش‌فرض عمومی سیستم
    if (!layout) {
      layout = await prisma.dashboardLayout.findFirst({
        where: { scope: "default" },
      });
    }

    return layout ? JSON.parse(layout.layout) : null;
  } catch (error) {
    console.error("Failed to load dashboard layout:", error);
    return null;
  }
}

export async function saveDashboardLayoutAction(layoutData: any, scope: "user" | "role" | "default" = "user") {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };

  const userId = scope === "user" ? session.id : null;
  const roleId = scope === "role" ? session.role : null;

  try {
    const layoutJson = JSON.stringify(layoutData);

    const existing = await prisma.dashboardLayout.findFirst({
      where: {
        scope,
        userId,
        roleId,
      },
    });

    if (existing) {
      await prisma.dashboardLayout.update({
        where: { id: existing.id },
        data: { layout: layoutJson },
      });
    } else {
      await prisma.dashboardLayout.create({
        data: {
          scope,
          userId,
          roleId,
          layout: layoutJson,
        },
      });
    }

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
```

Note the fallback chain in `getDashboardLayout`: user → role → default. The
`"default"` row is the widest blast radius, `"role"` the next widest.

Note also there is **no `audit(...)` call** in this file, unlike almost every
other mutating action in `src/app/actions/`.

### `prisma/schema.prisma:232-241` — the model

```prisma
model DashboardLayout {
  id        Int      @id @default(autoincrement())
  scope     String   @default("default") // "default" | "role" | "user"
  userId    Int?
  roleId    Int?
  layout    String   // JSON string
  updatedAt DateTime @updatedAt

  @@unique([scope, userId, roleId])
}
```

`scope` is a free-form `String`, not an enum — so an unrecognised value would
create a row that `getDashboardLayout` never reads. Worth rejecting.

### The call sites

```bash
grep -rn "saveDashboardLayoutAction" src/
```

Expected: the definition plus its use in
`src/app/(main)/dashboard/DashboardClient.tsx`. Read every call site before
changing the signature and record which scopes are actually passed — if the UI
only ever passes `"user"`, the other two arms are reachable solely over the
network.

### The permission to use — `src/lib/perms.ts:27`

```ts
  "settings.global",  // تنظیمات سراسری سیستم
```

with the label at `src/lib/perms.ts:57`:

```ts
  "settings.global": "تنظیمات سراسری سیستم",
```

This is the closest existing permission to "change something system-wide". Do
not invent a new permission key — adding to `ALL_PERMS` means every stored
`AccessRole.permissions` JSON blob is now missing it, and existing roles would
silently lose capability. Reuse `settings.global`.

Legacy roles that hold `settings.global` today, per `src/lib/perms.ts:64-75`:
role 4 and role 1 (all permissions), and role 2 (listed explicitly at line 71).
Role 3 and role 0 do not.

### The gate shape used everywhere else

`src/app/actions/line.ts:110-114` is a representative example:

```ts
export async function saveLinePositions(positions: { id: number; posX: number; posY: number; rotation: number }[]) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "depot.layout"))) {
```

### The audit helper — `src/lib/audit.ts:30-38`

```ts
export async function audit(
  session: Session | null,
  entity: string,
  entityId: number,
  action: "CREATE" | "UPDATE" | "DELETE" | "CONFIRM",
  before: any,
  after: any,
  customSummary?: string
) {
```

`src/app/actions/lookups.ts:178-186` shows the calling convention for a
settings-shaped change.

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
- `src/app/actions/dashboard.ts`
- `src/lib/__tests__/dashboard-scope.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `prisma/schema.prisma`. Turning `scope` into an enum would need a migration
  for no security benefit once the action validates it.
- `src/app/(main)/dashboard/DashboardClient.tsx` — unless a call site passes a
  scope that the new gate would reject, in which case see STOP conditions.
- `src/lib/perms.ts`. Do not add a new permission key; reuse `settings.global`.
- `getDashboardLayout`'s fallback chain. The read path is fine.
- The dashboard's own data queries in `src/app/(main)/dashboard/page.tsx` —
  the 10-count loop there is plan 010.

## Git workflow

- Branch: `advisor/008-authorize-dashboard-layout-scope`
- Plain imperative commit subjects, e.g. `Gate shared dashboard layout writes`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the call sites first

```bash
grep -rn "saveDashboardLayoutAction" src/
```

For each call site, note which `scope` value it passes. Write the answer into
your report before editing anything — the gate you add must not break a
legitimate UI path.

If any call site passes `"role"` or `"default"` from a control that is visible
to users without `settings.global`, that is a STOP condition: the fix would
break a working feature and the product intent needs a decision first.

### Step 2: Validate the scope and gate the shared ones

Rewrite the head of `saveDashboardLayoutAction`:

```ts
const LAYOUT_SCOPES = ["user", "role", "default"] as const;
type LayoutScope = (typeof LAYOUT_SCOPES)[number];

export async function saveDashboardLayoutAction(
  layoutData: any,
  scope: LayoutScope = "user"
) {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };

  // scope از سمت کلاینت می‌آید و تایپ TypeScript تضمینی ایجاد نمی‌کند
  if (!LAYOUT_SCOPES.includes(scope)) {
    return { error: "دامنه چیدمان نامعتبر است." };
  }

  // چیدمان نقش و چیدمان پیش‌فرض روی کاربران دیگر اثر می‌گذارند
  if (scope !== "user" && !(await hasPerm(session, "settings.global"))) {
    return { error: "دسترسی ندارید. تغییر چیدمان مشترک نیازمند مجوز تنظیمات سراسری است." };
  }

  const userId = scope === "user" ? session.id : null;
  const roleId = scope === "role" ? session.role : null;
```

Leave the rest of the function body as it is.

Add the import:

```ts
import { hasPerm } from "@/lib/perms";
```

Two things to be precise about:

- The runtime `LAYOUT_SCOPES.includes` check is not redundant with the
  TypeScript union. Server-action arguments arrive over the network; the type
  is compile-time documentation only. This is the same reasoning applied in
  plan 006 to `saveBrandingSettings`.
- The gate is `scope !== "user"`, deliberately covering both `"role"` and
  `"default"`. A role layout affects every holder of that role, which is a
  shared write even though it feels narrower than `"default"`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "settings.global" src/app/actions/dashboard.ts` → present
- `grep -n "LAYOUT_SCOPES.includes" src/app/actions/dashboard.ts` → present

### Step 3: Record shared-layout changes in the audit log

`src/app/actions/dashboard.ts` currently writes nothing to `AuditLog`, so a
change to the system-wide dashboard leaves no trace. Add an `audit(...)` call
for the shared scopes only — a user rearranging their own dashboard is noise,
not an auditable event.

Place it after the successful upsert, before `revalidatePath`:

```ts
    if (scope !== "user") {
      await audit(
        session,
        "dashboardLayout",
        existing?.id ?? 0,
        existing ? "UPDATE" : "CREATE",
        null,
        { scope, roleId },
        scope === "default"
          ? "چیدمان پیش‌فرض داشبورد سامانه بازنویسی شد."
          : `چیدمان داشبورد نقش ${session.role} بازنویسی شد.`
      );
    }
```

Do **not** pass the layout JSON as the `after` value. It is a large blob and
`computeDiff` (`src/lib/audit.ts:16`) skips object-valued keys anyway, so it
would add nothing but weight. Passing `{ scope, roleId }` records what changed
without the payload.

Note that `existing` is declared inside the `try` block at the current line 49;
the audit call must be inside the same block to see it.

Add the import:

```ts
import { audit } from "@/lib/audit";
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "dashboardLayout" src/app/actions/dashboard.ts` → the audit entity
  string is present

### Step 4: Add a test for the scope constant

Create `src/lib/__tests__/dashboard-scope.test.ts`.

The action itself calls Prisma and `getSession`, so it cannot be unit-tested
here — this repo has no database test harness (plan 001 deferred one). What
*can* be tested is the scope constant, and that is worth doing because it is
the thing a future edit is most likely to get wrong.

Export `LAYOUT_SCOPES` from `src/app/actions/dashboard.ts` so the test can
import it.

> A file with `"use server"` may only export async functions. Exporting a
> constant array from it will fail to compile. If that happens, move
> `LAYOUT_SCOPES` into a small non-`"use server"` module —
> `src/lib/dashboard-layout.ts` — and import it from the action. Prefer that
> route if there is any doubt; it is cleaner and matches how
> `src/lib/branding.ts` is structured in plan 006. Add the new file to your
> report as an extra in-scope file if you take it.

Required cases:
- `LAYOUT_SCOPES` contains exactly `"user"`, `"role"`, `"default"`
- `"global"`, `""`, and `"USER"` are not members (the check is exact and
  case-sensitive)
- the shared-scope predicate — whatever form it takes — treats `"role"` and
  `"default"` as shared and `"user"` as not

If you extract a helper such as `isSharedScope(scope)` to make the last case
testable, keep it in the same non-`"use server"` module.

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 5: Confirm at runtime

Start the dev server (`npm run dev`).

1. Log in with an account holding `settings.global` (any role 1, 2, or 4
   account, per `src/lib/perms.ts:64-75`). Rearrange the dashboard and save.
   Confirm the personal layout persists across a reload.
2. Log in with a role 3 or role 0 account. Confirm the dashboard still loads and
   the personal `"user"` scope save still works — this plan must not restrict
   that.
3. Call `saveDashboardLayoutAction(someLayout, "default")` from the role 3
   account's session — through the browser console on a page where it is
   imported, or however you can reach the action directly.

**Verify**: (3) returns the access error and the `DashboardLayout` row with
`scope: "default"` is unchanged. Confirm with a direct query, e.g.
`npx prisma studio` or a one-off script — do not modify the database.

If you cannot obtain two accounts with different permissions, say so in your
report rather than marking these as passed.

### Step 6: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/dashboard-scope.test.ts` — 3–4 cases per Step 4.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, English test
  names.
- The action is verified by the runtime checks in Step 5, not by unit tests.
  Record which of the three checks you were able to run.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "hasPerm(session, \"settings.global\")" src/app/actions/dashboard.ts` returns a match
- [ ] `grep -n "LAYOUT_SCOPES" src/app/actions/dashboard.ts` returns matches
- [ ] `grep -n "audit(" src/app/actions/dashboard.ts` returns a match
- [ ] `prisma/schema.prisma` and `src/lib/perms.ts` are unmodified:
      `git diff --name-only` lists neither
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new scope cases
- [ ] `npm run build` exits 0
- [ ] Step 1's call-site survey is recorded in the report
- [ ] Step 5 outcomes recorded, including any check that could not be run
- [ ] `git status --porcelain` lists only the In-scope files, plus
      `src/lib/dashboard-layout.ts` if Step 4 required extracting it
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- Step 1 finds a UI control that passes `"role"` or `"default"` and is visible
  to users without `settings.global`. Adding the gate would break a working
  feature; the product decision comes first.
- Exporting `LAYOUT_SCOPES` from the `"use server"` file fails to compile and
  extracting it to `src/lib/dashboard-layout.ts` also causes problems. Report
  the error rather than dropping the test.
- A role 3 or role 0 account can no longer save its **own** dashboard layout
  after your change. That means the gate caught the `"user"` scope; the
  condition must be `scope !== "user"`, not a blanket permission check.
- You conclude a new permission key is needed. It is not — adding to
  `ALL_PERMS` in `src/lib/perms.ts:5-31` would leave every stored
  `AccessRole.permissions` JSON blob without it. Report instead.

## Maintenance notes

- **The rule: `"user"` scope is self-service, everything else requires
  `settings.global`.** If a fourth scope is ever added — per-terminal, per-shift
  — it must be classified on that axis explicitly, not defaulted. The
  `LAYOUT_SCOPES` constant and the `scope !== "user"` condition are the two
  places to touch together.
- The `scope` column is a free-form `String` in `prisma/schema.prisma:234`. The
  runtime validation added here is the only thing keeping unrecognised values
  out of the table. If that validation is removed, junk rows become writable
  again — invisible, because `getDashboardLayout` never reads them.
- This action is the only mutating server action in `src/app/actions/` that had
  no audit call. After this plan it audits shared writes only. If the audit log
  is ever used to reconstruct "who changed what", personal layout changes will
  not be in it — that is intentional.
- A reviewer should check that the audit call does not pass the layout JSON as
  its `before`/`after` payload. `computeDiff` skips object values
  (`src/lib/audit.ts:16`), so it would bloat the row for no benefit.
