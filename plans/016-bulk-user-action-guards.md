# Plan 016: Restore the role-hierarchy and reference guards on the bulk user actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Setup on a fresh checkout**: run `npm install` **and** `npx prisma generate`
> before anything else. There is no `postinstall` hook, and without the
> generated Prisma client `npx tsc --noEmit` fails with ~25 phantom `TS7006`
> errors.
>
> **Drift check (run first)**:
> `git diff --stat <planned-at SHA>..HEAD -- src/app/actions/user.ts src/lib/perms.ts`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: security
- **Planned at**: commit `7f79433`, 2026-07-29

## Why this matters

`src/app/actions/user.ts` enforces a role hierarchy on single-record operations
and drops it entirely on the bulk equivalents. Measured across the file:

| Action | `isRoleAllowedToManage` | manovr-reference guard |
|---|---|---|
| `createUser` | yes | — |
| `updateUser` | yes (×2) | — |
| `resetPassword` | yes | — |
| `deleteUser` | yes | yes |
| **`bulkUpdateUserShift`** | **no** | — |
| **`bulkUpdateUserOrgPosition`** | **no** | — |
| **`bulkDeleteUsers`** | **no** | **no** |

Two distinct failures follow.

**1. Privilege hierarchy bypass.** `deleteUser` refuses to delete a user at or
above the caller's own level — `isRoleAllowedToManage` is strictly
greater-than (`src/lib/perms.ts:126-128`), so an admin cannot even delete a
peer. `bulkDeleteUsers` checks only that the caller holds `user.manage` and that
the target is not the caller. A role-1 admin can therefore select a role-4
super-admin in the users table, use the bulk-delete action, and remove an
account the single-record path explicitly protects. The same applies to
reassigning a super-admin's shift or organisational position.

**2. Silent destruction of historical records.** `deleteUser` refuses to delete
personnel referenced by any maneuver (`user.ts:291-295`), because the foreign
keys are `ON DELETE SET NULL`. Verified directly against the live database
schema in `prisma/dev.db`:

```
CONSTRAINT "Manovr_rahbar1Id_fkey" FOREIGN KEY ("rahbar1Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE
CONSTRAINT "Manovr_rahbar2Id_fkey" FOREIGN KEY ("rahbar2Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE
CONSTRAINT "Manovr_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE
```

`bulkDeleteUsers` has no such guard, so it succeeds — and every maneuver those
people led or recorded keeps its row while losing its operator attribution,
permanently and without error. On a rail depot system whose entire purpose is
recording who moved which train where, that is the destruction of the primary
record.

It is worse for tickets. `Ticket.creatorId` is `ON DELETE CASCADE`
(`prisma/schema.prisma:268`), verified in the same database:

```
CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE
```

So bulk-deleting a user also deletes every support ticket they ever opened,
along with its replies and history (both cascade from `Ticket`). `Notification`
cascades from `Personnel` too (`prisma/schema.prisma:219`).

This plan makes the bulk paths enforce what the single-record paths already do.
It adds refusals only; no successful operation changes its outcome.

## Current state

### The guard that exists — `src/app/actions/user.ts:261-301`, `deleteUser`

```ts
export async function deleteUser(id: number) {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === 2;

  if (!hasManagePerm && !isShiftSupervisor) return { error: "دسترسی ندارید." };

  if (id === session.id) return { error: "نمی‌توانید خودتان را حذف کنید." };

  const targetUser = await prisma.personnel.findUnique({ where: { id } });
  if (!targetUser) return { error: "کاربر مورد نظر یافت نشد." };

  if (!isRoleAllowedToManage(session.role, targetUser.role)) {
    return { error: "شما مجاز به حذف این کاربر نیستید (هم‌سطح یا بالاتر از شما)." };
  }
  ...
  const manovrCount = await prisma.manovr.count({
    where: { OR: [{ rahbar1Id: id }, { rahbar2Id: id }, { creatorId: id }] },
  });
  if (manovrCount > 0)
    return { error: "این کاربر در مانورها ثبت شده و قابل حذف نیست. حساب را غیرفعال کنید." };

  await prisma.personnel.delete({ where: { id } });
```

Note the wording of the manovr refusal: it tells the operator to **deactivate**
the account instead. That is the intended path, and the bulk action should say
the same thing.

### The three unguarded actions — `src/app/actions/user.ts:401-464`

```ts
export async function bulkUpdateUserShift(ids: number[], shift: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر شیفت کاری دسته‌جمعی پرسنل را دارد." };
  }

  try {
    await prisma.personnel.updateMany({
      where: { id: { in: ids } },
      data: { shift },
    });

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkUpdateUserOrgPosition(ids: number[], orgPosition: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر سمت دسته‌جمعی پرسنل را دارد." };
  }

  try {
    await prisma.personnel.updateMany({
      where: { id: { in: ids } },
      data: { orgPosition },
    });

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkDeleteUsers(ids: number[]) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه حذف دسته‌جمعی پرسنل را دارد." };
  }

  try {
    // جلوگیری از حذف اکانت جاری ادمین
    const filteredIds = ids.filter((id) => id !== session.id);
    if (filteredIds.length === 0) {
      return { error: "امکان حذف حساب کاربری خودتان وجود ندارد." };
    }

    await prisma.personnel.deleteMany({
      where: { id: { in: filteredIds } },
    });

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: filteredIds.length };
  } catch (err: any) {
    return { error: err.message };
  }
}
```

Note that all three gate on `user.manage` only — the shift-supervisor path
(`orgPosition === 2`) that `deleteUser` admits cannot reach these, so supervisor
scoping is not a concern here.

### The hierarchy helper — `src/lib/perms.ts:114-128`

```ts
export function getRoleLevel(role: number): number {
  if (role === 4) return 100; // Super Admin (سوپرادمین)
  if (role === 1) return 80;  // Admin (مدیر/ادمین)
  if (role === 2) return 50;  // Operator (مسئول شیفت/مسئول)
  if (role === 3) return 30;  // Viewer (مشاهده)
  return 0;                   // Guest / No Access (بدون دسترسی)
}

export function isRoleAllowedToManage(actorRole: number, targetRole: number): boolean {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}
```

Strictly greater-than: a peer cannot manage a peer. Plan 001 has unit tests
pinning this at `src/lib/__tests__/perms.test.ts`.

### The callers — `src/app/(main)/users/UsersTableClient.tsx`

The three actions are invoked from `BulkAction` handlers, which pass
`items.map((i) => i.id)` and surface failures with `alert(res.error)`. So
returning `{ error }` is already handled by the UI; you do not need to touch the
client. Confirm before starting:

```bash
grep -n "bulkUpdateUserShift\|bulkUpdateUserOrgPosition\|bulkDeleteUsers" "src/app/(main)/users/UsersTableClient.tsx"
```

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Install   | `npm install`              | exit 0              |
| Generate Prisma client | `npx prisma generate` | exit 0        |
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |
| Dev run   | `npm run dev`              | serves on :3000     |

## Scope

**In scope** (the only files you should modify or create):
- `src/app/actions/user.ts` — the three bulk actions only
- `src/lib/bulk-guards.ts` (create — the pure predicate helpers)
- `src/lib/__tests__/bulk-guards.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `deleteUser`, `updateUser`, `createUser`, `resetPassword`. Their guards are
  correct and are the model being copied.
- `prisma/schema.prisma`. Changing `Manovr.rahbar1Id` from `SET NULL` to
  `RESTRICT` would enforce this at the database layer, which is arguably the
  better fix — but it needs a migration, it would make `deleteUser`'s existing
  check redundant-but-harmless, and it changes failure modes across the app. See
  Maintenance notes; not this plan.
- `src/app/(main)/users/UsersTableClient.tsx`. It already surfaces `res.error`
  via `alert`. If it turns out not to, that is a STOP condition.
- Adding `audit()` calls to these actions. That is plan 014. If 014 has already
  landed you will see `audit(...)` in these functions — leave it in place and
  add your guards **before** the write, so a refused operation is not audited as
  a success.
- `updatePersonnelPhoneInfo`, which also lacks a hierarchy check. It requires
  `phonebook.edit` and writes only contact fields — a lesser concern, noted in
  Maintenance notes rather than fixed here.
- `importPersonnelFromExcel`, whose hierarchy handling **demotes** rather than
  rejects (`user.ts:359-362`). That is deliberate and documented in the code.

## Git workflow

- Branch: `advisor/016-bulk-user-action-guards`
- One commit is fine; plain imperative subject, e.g.
  `Enforce role hierarchy on bulk user actions`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the pure guard helpers

Create `src/lib/bulk-guards.ts`. No Prisma import — it takes already-fetched
rows, so it is unit-testable.

```ts
import { isRoleAllowedToManage } from "@/lib/perms";

export interface ManageableTarget {
  id: number;
  role: number;
}

/**
 * شناسه‌هایی را برمی‌گرداند که اقدام‌کننده مجاز به مدیریت آنها نیست
 * (هم‌سطح یا بالاتر از خودش).
 */
export function findUnmanageableIds(
  actorRole: number,
  targets: ManageableTarget[]
): number[] {
  return targets
    .filter((t) => !isRoleAllowedToManage(actorRole, t.role))
    .map((t) => t.id);
}

/**
 * شناسه‌هایی که در درخواست بودند اما در دیتابیس یافت نشدند.
 */
export function findMissingIds(
  requestedIds: number[],
  found: ManageableTarget[]
): number[] {
  const foundSet = new Set(found.map((t) => t.id));
  return requestedIds.filter((id) => !foundSet.has(id));
}
```

`isRoleAllowedToManage` is imported from `@/lib/perms`, which is safe: that
function is pure and the module's Prisma import is only used by `getUserPerms`,
which this code path never calls.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "prisma" src/lib/bulk-guards.ts` → 0

### Step 2: Guard `bulkUpdateUserShift` and `bulkUpdateUserOrgPosition`

Both take the same shape. Insert after the permission check and **before** the
`updateMany`, inside the existing `try`:

```ts
    const targets = await prisma.personnel.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });

    const blocked = findUnmanageableIds(session.role, targets);
    if (blocked.length > 0) {
      return {
        error: `شما مجاز به تغییر ${blocked.length} کاربر از موارد انتخاب‌شده نیستید (هم‌سطح یا بالاتر از شما). هیچ تغییری اعمال نشد.`,
      };
    }
```

**Reject the whole operation rather than silently skipping the disallowed
rows.** A bulk action that reports success while having quietly skipped some
targets is how an operator ends up believing a change was applied when it was
not. The message states explicitly that nothing was applied.

Keep the existing `updateMany` exactly as it is — once the guard passes, every
id in `ids` is permitted.

Add the import:

```ts
import { findUnmanageableIds } from "@/lib/bulk-guards";
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `awk '/^export async function bulkUpdateUserShift/,/^}/' src/app/actions/user.ts | grep -c "findUnmanageableIds"` → 1
- Same for `bulkUpdateUserOrgPosition` → 1
- In each, the `findUnmanageableIds` line precedes the `updateMany` line:
  `awk '/^export async function bulkUpdateUserShift/,/^}/' src/app/actions/user.ts | grep -n "findUnmanageableIds\|updateMany"`

### Step 3: Guard `bulkDeleteUsers` — hierarchy and references

This one needs both checks. Insert after `filteredIds` is computed
(`user.ts:449-452`) and before the `deleteMany`:

```ts
    const targets = await prisma.personnel.findMany({
      where: { id: { in: filteredIds } },
      select: { id: true, role: true },
    });

    const blocked = findUnmanageableIds(session.role, targets);
    if (blocked.length > 0) {
      return {
        error: `شما مجاز به حذف ${blocked.length} کاربر از موارد انتخاب‌شده نیستید (هم‌سطح یا بالاتر از شما). هیچ کاربری حذف نشد.`,
      };
    }

    // همان محافظی که deleteUser اعمال می‌کند: کلیدهای خارجی مانور ON DELETE SET NULL
    // هستند، بنابراین حذف پرسنلِ ارجاع‌شده، نسبت‌دادن اپراتور را از سوابق مانور
    // به‌صورت خاموش پاک می‌کند.
    const referenced = await prisma.manovr.findMany({
      where: {
        OR: [
          { rahbar1Id: { in: filteredIds } },
          { rahbar2Id: { in: filteredIds } },
          { creatorId: { in: filteredIds } },
        ],
      },
      select: { rahbar1Id: true, rahbar2Id: true, creatorId: true },
    });

    if (referenced.length > 0) {
      const referencedIds = new Set<number>();
      for (const m of referenced) {
        for (const v of [m.rahbar1Id, m.rahbar2Id, m.creatorId]) {
          if (v !== null && filteredIds.includes(v)) referencedIds.add(v);
        }
      }
      return {
        error: `${referencedIds.size} کاربر از موارد انتخاب‌شده در مانورها ثبت شده‌اند و قابل حذف نیستند. حساب آنها را غیرفعال کنید. هیچ کاربری حذف نشد.`,
      };
    }
```

Two points of care:

- The `referencedIds` set is built by walking the returned maneuver rows because
  a single maneuver can reference up to three of the selected users, and the
  operator needs a count of **users**, not maneuvers.
- The refusal message repeats `deleteUser`'s guidance — deactivate rather than
  delete (`user.ts:295`). Keep that wording consistent; it is the documented
  escape hatch.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `awk '/^export async function bulkDeleteUsers/,/^}/' src/app/actions/user.ts | grep -n "findUnmanageableIds\|prisma.manovr.findMany\|deleteMany"` → all three present, in that order

### Step 4: Test the guard helpers

Create `src/lib/__tests__/bulk-guards.test.ts`.

`findUnmanageableIds` — required cases:
- A role-1 actor against targets `[{id:1,role:3},{id:2,role:0}]` → `[]`
  (both below)
- A role-1 actor against `[{id:1,role:4}]` → `[1]` (super-admin is above)
- A role-1 actor against `[{id:1,role:1}]` → `[1]` — **peer cannot manage peer**;
  this is the case the strictly-greater-than comparison exists for
- A role-4 actor against `[{id:1,role:1},{id:2,role:4}]` → `[2]` (another
  super-admin is a peer)
- Mixed: role-1 actor against `[{id:1,role:3},{id:2,role:4},{id:3,role:0}]`
  → `[2]` only
- Empty target list → `[]`

`findMissingIds` — required cases:
- Requested `[1,2,3]`, found `[{id:1,role:0},{id:3,role:0}]` → `[2]`
- Requested `[]` → `[]`
- All found → `[]`

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 5: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

### Step 6: Confirm at runtime

Start the dev server (`npm run dev`) and log in as a **role-1 admin** holding
`user.manage`. In `/users`:

1. Select a role-3 or role-0 user with no maneuver history and bulk-change their
   shift. **Expect success** — the happy path must be unaffected.
2. Select a **role-4 super-admin** and attempt a bulk shift change. Expect the
   hierarchy refusal, and confirm with a direct query that the super-admin's
   `shift` is unchanged.
3. Attempt to bulk-delete that same super-admin. Expect the hierarchy refusal
   and no deletion.
4. Select a user who **has** maneuver history and bulk-delete. Expect the
   "recorded in maneuvers, deactivate instead" refusal, and confirm the user
   still exists.
5. Confirm the single-record `deleteUser` path is unchanged — deleting an
   eligible user from the row action still works.

**Verify**: all five. Case (1) is as important as the refusals — a guard that
blocks legitimate work is a failed fix. Record each outcome.

If you cannot obtain a role-4 account to test against, say so plainly rather
than marking (2) and (3) as passed; the unit tests in Step 4 cover the predicate
either way.

## Test plan

- New file: `src/lib/__tests__/bulk-guards.test.ts` — 9 cases per Step 4.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` (created by
  plan 001) — explicit `import { describe, it, expect } from "vitest"`, English
  test names.
- `src/lib/bulk-guards.ts` imports only `@/lib/perms`, whose exported pure
  functions have no side effects on import, so the test file needs no setup.
- The peer-cannot-manage-peer case is the one most likely to regress if someone
  later "relaxes" `isRoleAllowedToManage` to `>=`. Plan 001 tests that helper
  directly; this file tests that the bulk path actually uses it.
- The three server actions are not unit-tested — all require Prisma and a
  session, and this repo has no database test harness (plan 001 deferred one).
  They are verified by the `awk`/`grep` ordering checks and the runtime walk in
  Step 6.
- Verification: `npm run test:run` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f src/lib/bulk-guards.ts` succeeds; `grep -c "prisma" src/lib/bulk-guards.ts` returns 0
- [ ] `grep -c "findUnmanageableIds" src/app/actions/user.ts` returns 3 (import plus three uses)
- [ ] `awk '/^export async function bulkDeleteUsers/,/^}/' src/app/actions/user.ts | grep -c "prisma.manovr"` returns 1
- [ ] In each of the three bulk actions, the guard precedes the write — verified
      with the `awk` commands in Steps 2 and 3
- [ ] `deleteUser` is unchanged:
      `awk '/^export async function deleteUser/,/^}/' src/app/actions/user.ts | grep -c "isRoleAllowedToManage"` returns 1
- [ ] `prisma/schema.prisma` is unmodified: `git diff --name-only` does not list it
- [ ] `src/app/(main)/users/UsersTableClient.tsx` is unmodified
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the 9 new guard cases
- [ ] `npm run build` exits 0
- [ ] All five Step 6 outcomes recorded, including any that could not be run
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 016 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file. Note
  that if plan 014 has landed, these three functions will contain `audit(...)`
  calls — that is expected, not drift. Place your guards **before** the write and
  before the audit call.
- Step 6 case (1) fails — a legitimate bulk shift change on a low-role user is
  refused. The guard is too broad; report the observed error.
- `src/app/(main)/users/UsersTableClient.tsx` turns out **not** to surface
  `res.error` to the operator. Then these refusals would be silent, which is
  worse than the current behaviour. Report before proceeding.
- You conclude the schema's `ON DELETE SET NULL` should be changed to
  `RESTRICT`. It is a defensible fix and it is not this plan's — it needs a
  migration and a review of every delete path. Report instead.
- The reference check makes bulk delete unusably slow on a realistic selection.
  It is two indexed queries (`Manovr` has indexes on `type`, `status`,
  `createdAt` but **not** on `rahbar1Id`/`creatorId` — see
  `prisma/schema.prisma:193-195`), so a large table could scan. If you measure a
  real problem, report it rather than dropping the check.
- You find a fourth bulk action on `Personnel` anywhere in `src/`. Search:
  `grep -rn "personnel.updateMany\|personnel.deleteMany" src/`. Three are
  expected.

## Maintenance notes

- **The invariant: any code path that mutates or deletes a `Personnel` row must
  call `isRoleAllowedToManage` against the target's role.** There are now four
  such paths with the check (`createUser`, `updateUser`, `resetPassword`,
  `deleteUser`) and three more added here. A reviewer seeing a new
  `personnel.update`/`delete`/`updateMany`/`deleteMany` without it should treat
  that as the defect this plan fixed, recurring.
- **The database would enforce this better than the application does.**
  `Manovr.rahbar1Id`, `rahbar2Id`, and `creatorId` are `ON DELETE SET NULL`
  (verified in `prisma/dev.db`), which is why deleting a referenced operator
  silently succeeds at the storage layer and has to be blocked in code — in two
  places now, and in any third that appears. Changing those three to
  `onDelete: Restrict` in `prisma/schema.prisma` would make the guard
  belt-and-braces rather than load-bearing. That is a schema migration with
  app-wide failure-mode implications and deserves its own plan; it is the more
  robust long-term answer.
- **`Ticket.creatorId` is `ON DELETE CASCADE`** (`prisma/schema.prisma:268`), and
  `TicketReply`/`TicketHistory` cascade from `Ticket`. So deleting a user still
  destroys their entire support history — this plan does not address that,
  because the maneuver guard will usually block the delete first, but a user with
  tickets and no maneuvers is still deletable and still loses everything.
  `Notification` cascades from `Personnel` too (`prisma/schema.prisma:219`).
  Whether that is intended is a product question worth asking.
- `updatePersonnelPhoneInfo` (`user.ts:305`) has no hierarchy check either. It
  requires `phonebook.edit` and writes only `phone1`, `phone2`, `internalTel`,
  `address`, and `avatarColor` — no privilege or identity fields — so it is a
  lesser concern, deliberately left alone. If `phonebook.edit` is ever granted
  more widely, revisit it.
- Rejecting the whole batch rather than skipping disallowed rows is deliberate.
  If operators find that annoying in practice, the right change is to surface
  *which* rows are blocked in the UI before submission, not to make the server
  silently partial-apply.
