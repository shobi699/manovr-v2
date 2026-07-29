# Plan 014: Record user, role, and line changes in the audit log

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
> `git diff --stat <planned-at SHA>..HEAD -- src/app/actions/user.ts src/app/actions/role.ts src/app/actions/line.ts src/lib/audit.ts`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md, **plans/013-audit-diff-null-transitions.md**
- **Category**: security
- **Planned at**: commit `893b103`, 2026-07-29

## Why this matters

This system has an audit log: an `AuditLog` table, a dedicated `audit.view`
permission (`src/lib/perms.ts:25`), and an admin page at
`src/app/(main)/admin/audit/` for reading it. Twenty-six `audit()` calls exist
across maneuvers, trains, lookups, backups, profiles, and scheduled reports.

It records **nothing** about identity and access management. Measured:

| File | Mutating actions | `audit()` calls |
|---|---|---|
| `src/app/actions/user.ts` | 9 | **0** |
| `src/app/actions/role.ts` | 3 | **0** |
| `src/app/actions/line.ts` | 6 | **0** |

So there is no record of who created a user account, who changed someone's
role, who assigned or revoked a custom access role, who reset another user's
password, who deleted a user, or who edited the permission set that defines what
a whole class of users can do.

That is the wrong way round. An audit log that captures train movements but not
privilege grants inverts the actual risk. And because the log *looks* complete —
it has entries, timestamps, actor names — its silence about IAM reads as "nothing
happened" rather than "not recorded".

`line.ts` is included because it is the third file with the same gap and the
same fix; line capacity and terminal assignment feed the maneuver capacity
checks in `src/app/actions/manovr.ts`, so changing them silently is worth
knowing about.

**This plan depends on plan 013 and must not land before it.** Assigning a user
their first access role is `accessRoleId: null → 5`, and until 013 fixes the
`typeof null === "object"` guard in `computeDiff`, that exact transition is
silently dropped from the diff. Landing 014 first would produce audit rows for
role assignment that omit the role.

## Current state

### The `audit()` contract — `src/lib/audit.ts:30-38`

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

It computes `computeDiff(before, after)`, writes an `AuditLog` row, fires
notification side effects, and emits an SSE event. `computeDiff` excludes
`passwordHash`, `createdAt`, `updatedAt`, and `id` via its `ignoreKeys` list
(`src/lib/audit.ts:11`) — plan 001 has a regression test pinning that.

### The exemplar to match — `src/app/actions/train.ts:174-199`

```ts
export async function updateTrainStatus(trainId: number, status: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر وضعیت قطار را دارد." };
  }

  try {
    const before = await prisma.train.findUnique({ where: { id: trainId } });
    const after = await prisma.train.update({
      where: { id: trainId },
      data: { status },
    });

    await audit(
      session,
      "train",
      trainId,
      "UPDATE",
      before,
      after,
      `وضعیت فنی قطار پلاک ${before?.code} تغییر یافت.`
    );
```

Read `before`, perform the write capturing `after`, then `audit(...)` with a
Persian summary. Match this shape.

### Entity naming already in use

`"manovr"`, `"train"`, `"branding"`, `"backup"`, `"scheduledReport"`, and
`"personnel"` (see `src/app/actions/profile.ts:36`). Use **`"personnel"`** for
`user.ts`, **`"accessRole"`** for `role.ts`, **`"line"`** for `line.ts`.

### The `redirect()` trap — affects 6 of the actions

`createUser` (`user.ts:103`), `updateUser` (`:213`), `createRole`
(`role.ts:37`), `updateRole` (`:77`), `createLine` (`line.ts:46`), and
`updateLine` (`line.ts:88`) all end with `redirect(...)`.

In Next.js, `redirect()` works by **throwing** a control-flow signal. The
`audit()` call must come **before** it, and must not sit inside a `try`/`catch`
that would swallow the redirect. This is the same hazard called out in plan 009;
it is the most likely way to break these actions.

### Actions that currently discard the created record

`user.ts:79` and `user.ts:377`, `role.ts:26`, `line.ts:39` and `line.ts:170` all
call `prisma.<model>.create({...})` without assigning the result. You will need
the created record to audit it — capture it into a variable.

### `resetPassword` — `src/app/actions/user.ts:252-258`

```ts
  const hash = await bcrypt.hash(password, 10);
  await prisma.personnel.update({
    where: { id },
    data: { passwordHash: hash },
  });

  return { ok: true };
```

The plaintext password is in scope at that point. **It must never reach the
audit log** — not in `before`/`after`, not in the summary. See Step 3.

### The bulk actions — `updateMany` / `deleteMany` return counts, not records

`bulkUpdateUserShift` (`user.ts:401`), `bulkUpdateUserOrgPosition` (`:421`), and
`bulkDeleteUsers` (`:441`) use `updateMany`/`deleteMany`, which return
`{ count }`. There is no per-record `after` to diff.

`saveLinePositions` (`line.ts:110-124`) writes one `update` per line in a loop
and is driven by drag-and-drop on the depot map — it can fire many times per
minute per operator.

### `role.ts` — the permission set itself

`createRole` (`role.ts:26-32`) and `updateRole` (`:69-72`) write
`permissions: JSON.stringify(permsRaw)` — a JSON **string** column
(`prisma/schema.prisma:57`). Because it is a scalar string, `computeDiff` will
diff it correctly, producing a readable old/new of the permission list. That is
exactly the record worth having.

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
- `src/app/actions/user.ts`
- `src/app/actions/role.ts`
- `src/app/actions/line.ts`
- `src/lib/audit-summaries.ts` (create — Persian summary builders)
- `src/lib/__tests__/audit-summaries.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/audit.ts`. Plan 013 owns `computeDiff`. This plan only **calls**
  `audit()`.
- **The missing role-hierarchy checks in the bulk actions.**
  `bulkDeleteUsers`, `bulkUpdateUserShift`, and `bulkUpdateUserOrgPosition` lack
  the `isRoleAllowedToManage` guard that `deleteUser` enforces, and
  `bulkDeleteUsers` also skips the manovr-reference check. That is a **separate,
  higher-severity finding** — see plan 016. Do not fix it here; mixing an
  authorization fix into an audit-logging change makes both harder to review.
  Add the audit calls only.
- The permission checks, hierarchy logic, and validation in any of the three
  files. Behaviour must not change — this plan only adds recording.
- `src/app/actions/profile.ts`, `manovr.ts`, `train.ts`, `lookups.ts`,
  `backup.ts`, `scheduled-report.ts` — already audited.
- `src/app/actions/auth.ts`. Login/logout auditing is a real gap but a different
  question (volume, failed-attempt policy, lockout) and deserves its own plan.
- `prisma/schema.prisma`. No migration is needed.

## Git workflow

- Branch: `advisor/014-audit-coverage-user-role-line`
- Commit per file (`user.ts`, `role.ts`, `line.ts`) — three reviewable units.
  Plain imperative subjects, e.g. `Audit user management actions`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the summary builders

Create `src/lib/audit-summaries.ts`. Pure string functions, no imports, so they
are testable and the Persian wording lives in one place.

```ts
// سازنده‌های خلاصه فارسی برای لاگ وقایع مدیریت کاربران، نقش‌ها و خطوط.
// بدون وابستگی — تا هم در اکشن‌ها و هم در تست‌ها قابل استفاده باشند.

const fullName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName ?? ""} ${lastName ?? ""}`.trim() || "بدون نام";

export function personnelCreatedSummary(p: { firstName?: string | null; lastName?: string | null; hasAccount?: boolean }) {
  return p.hasAccount
    ? `کاربر «${fullName(p.firstName, p.lastName)}» به همراه حساب کاربری ایجاد شد.`
    : `پرسنل «${fullName(p.firstName, p.lastName)}» بدون حساب کاربری ثبت شد.`;
}

export function personnelUpdatedSummary(p: { firstName?: string | null; lastName?: string | null }) {
  return `اطلاعات کاربر «${fullName(p.firstName, p.lastName)}» ویرایش شد.`;
}

export function personnelDeletedSummary(p: { firstName?: string | null; lastName?: string | null }) {
  return `کاربر «${fullName(p.firstName, p.lastName)}» از سامانه حذف شد.`;
}

// هرگز رمز عبور یا هش آن را در خلاصه قرار ندهید
export function passwordResetSummary(p: { firstName?: string | null; lastName?: string | null }) {
  return `رمز عبور کاربر «${fullName(p.firstName, p.lastName)}» توسط مدیر بازنشانی شد.`;
}

export function bulkPersonnelSummary(action: string, count: number, ids: number[]) {
  const shown = ids.slice(0, 20).join("، ");
  const more = ids.length > 20 ? ` و ${ids.length - 20} مورد دیگر` : "";
  return `${action} به صورت گروهی روی ${count} پرسنل انجام شد (شناسه‌ها: ${shown}${more}).`;
}

export function roleCreatedSummary(name: string, permCount: number) {
  return `نقش دسترسی «${name}» با ${permCount} مجوز ایجاد شد.`;
}

export function roleUpdatedSummary(name: string, permCount: number) {
  return `مجوزهای نقش دسترسی «${name}» ویرایش شد (${permCount} مجوز).`;
}

export function roleDeletedSummary(name: string) {
  return `نقش دسترسی «${name}» حذف شد.`;
}

export function lineCreatedSummary(name: string) {
  return `خط «${name}» ایجاد شد.`;
}

export function lineUpdatedSummary(name: string) {
  return `خط «${name}» ویرایش شد.`;
}

export function lineDeletedSummary(name: string) {
  return `خط «${name}» حذف شد.`;
}

export function importSummary(entityLabel: string, count: number) {
  return `${count} ${entityLabel} به صورت گروهی از فایل اکسل وارد سامانه شد.`;
}
```

The id list in `bulkPersonnelSummary` is capped at 20 so a 500-row bulk
operation does not write an unbounded string into the `summary` column.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "^import" src/lib/audit-summaries.ts` → 0

### Step 2: Audit `role.ts` first

Smallest file, three actions, and the highest-value records. Do it first to
establish the pattern.

In `src/app/actions/role.ts`, add `import { audit } from "@/lib/audit";` and the
summary imports, then:

**`createRole`** — capture the created record and audit before the `redirect`:

```ts
  const created = await prisma.accessRole.create({
    data: { name, permissions: JSON.stringify(permsRaw), isSystem: false },
  });

  await audit(
    session, "accessRole", created.id, "CREATE",
    null, created,
    roleCreatedSummary(created.name, permsRaw.length)
  );

  invalidatePermsCache();
  revalidatePath("/roles");
  revalidatePath("/users");
  redirect("/roles");
```

**`updateRole`** — `role` is already loaded at line 55 as the `before` value:

```ts
  const updated = await prisma.accessRole.update({ where: { id }, data: updateData });

  await audit(
    session, "accessRole", id, "UPDATE",
    role, updated,
    roleUpdatedSummary(updated.name, permsRaw.length)
  );
```

Passing `role` (the pre-update record fetched at line 55) as `before` gives a
real diff of the `permissions` JSON string — old permission list versus new.
That is the record this plan exists for.

**`deleteRole`** — `role` is loaded at line 86; audit after the delete:

```ts
  await prisma.accessRole.delete({ where: { id } });

  await audit(
    session, "accessRole", id, "DELETE",
    role, null,
    roleDeletedSummary(role.name)
  );
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "await audit(" src/app/actions/role.ts` → 3
- For each of `createRole` and `updateRole`, confirm the `audit(` line number is
  **less than** the `redirect(` line number:
  `awk '/^export async function updateRole/,/^}/' src/app/actions/role.ts | grep -n "await audit(\|redirect("`

### Step 3: Audit `user.ts`

Nine actions. Handle them in this order.

**`createUser`** — capture the record (currently discarded at line 79) and audit
before the `redirect` at line 103. Pass `null` as `before` (the CREATE path,
which `computeDiff` handles correctly). The created record contains
`passwordHash`, but `computeDiff` excludes it via `ignoreKeys` — verified, and
plan 001 has a test pinning it. **Do not pass the plaintext `password` variable
anywhere.**

**`updateUser`** — `targetUser` is already loaded at line 124; use it as
`before`. Capture the `update` result as `after`. Audit before the `redirect` at
line 213.

This is the most important single call site in the plan: it is where `role` and
`accessRoleId` change. With plan 013 landed, a `null → 5` access-role assignment
will appear in the diff.

**`resetPassword`** — there is nothing meaningful to diff (only `passwordHash`
changes, and it is excluded). Pass `null, null` and rely on the summary:

```ts
  await audit(
    session, "personnel", id, "UPDATE",
    null, null,
    passwordResetSummary(targetUser)
  );
```

**The plaintext password and the bcrypt hash must not appear in any argument.**
`targetUser` is the record fetched at line 239 — it contains `passwordHash`, so
do **not** pass it as `before`/`after`; pass only its name fields to the summary
builder, as shown.

**`deleteUser`** — `targetUser` is loaded at line 275. Audit after the delete at
line 297, with `before = targetUser`, `after = null`.

**`updatePersonnelPhoneInfo`** — fetch the record before the update at line 320
(it is not currently loaded), capture `after`, audit as `"UPDATE"` with
`personnelUpdatedSummary`.

**`importPersonnelFromExcel`** — do **not** audit per row; a 500-row import
would write 500 audit rows and fire 500 SSE emissions. Audit once after the loop,
with `entityId` `0`:

```ts
  if (count > 0) {
    await audit(session, "personnel", 0, "CREATE", null, null, importSummary("پرسنل", count));
  }
```

`entityId: 0` for aggregate events follows the existing convention in
`src/app/actions/lookups.ts:181` (`audit(session, "branding", 0, "UPDATE", ...)`).

**`bulkUpdateUserShift`, `bulkUpdateUserOrgPosition`, `bulkDeleteUsers`** —
`updateMany`/`deleteMany` return only a count. Audit once per operation with
`entityId: 0` and `bulkPersonnelSummary`, e.g.:

```ts
    await audit(
      session, "personnel", 0, "UPDATE",
      null, null,
      bulkPersonnelSummary("تغییر شیفت", ids.length, ids)
    );
```

For `bulkDeleteUsers` use `"DELETE"` and `filteredIds` (the list after
self-exclusion at line 449), not `ids`.

Note these three have their `prisma` call inside a `try`/`catch` — put the
`audit()` call inside the same `try`, after the write, so a failed write is not
audited.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "await audit(" src/app/actions/user.ts` → 9
- No password material reaches the audit call:
  `awk '/^export async function resetPassword/,/^}/' src/app/actions/user.ts | grep -n "audit(" -A4` — confirm neither `hash`, `password`, nor `targetUser` is passed as `before`/`after`
- Ordering for `createUser` and `updateUser`:
  `awk '/^export async function updateUser/,/^}/' src/app/actions/user.ts | grep -n "await audit(\|redirect("` → the `audit` line number is lower

### Step 4: Audit `line.ts`

**`createLine`**, **`updateLine`** — capture the record, audit before the
`redirect` (lines 46 and 88). For `updateLine`, fetch the pre-update row to pass
as `before`.

**`deleteLine`** — fetch the line before deleting at line 103 (it is not
currently loaded); audit with `before = line`, `after = null`.

**`toggleLineActive`** — fetch before, capture after, audit as `"UPDATE"` with
`lineUpdatedSummary`.

**`importLinesFromExcel`** — one aggregate row after the loop, same shape as the
personnel import: `importSummary("خط", count)`.

**`saveLinePositions`** — this is drag-and-drop on the depot map and can fire
many times per minute. Do **not** audit per line inside the loop. Write **one**
row after the loop:

```ts
  await audit(
    session, "line", 0, "UPDATE",
    null, null,
    `چیدمان ${positions.length} خط در نقشه پایانه بروزرسانی شد.`
  );
```

If this proves too noisy in practice it should be dropped entirely rather than
made per-line — note that in your report if you have an opinion.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "await audit(" src/app/actions/line.ts` → 6
- `awk '/^export async function saveLinePositions/,/^}/' src/app/actions/line.ts | grep -c "await audit("` → 1 (not inside the loop)

### Step 5: Test the summary builders

Create `src/lib/__tests__/audit-summaries.test.ts`.

Required cases:
- `personnelCreatedSummary({ firstName: "علی", lastName: "رضایی", hasAccount: true })`
  contains the full name and indicates an account was created
- the same with `hasAccount: false` produces the no-account wording
- `fullName` handling: `{ firstName: null, lastName: null }` yields the
  `"بدون نام"` fallback rather than an empty or `"null null"` string
- `passwordResetSummary` output contains **no** digits from a password and no
  `$2b$`/`$2a$` substring — assert
  `expect(passwordResetSummary({firstName:"a",lastName:"b"})).not.toMatch(/\$2[ab]\$/)`
- `bulkPersonnelSummary("حذف", 3, [1,2,3])` contains `3` and all three ids
- `bulkPersonnelSummary` with 25 ids caps the list at 20 and reports the
  remainder — assert the output length is bounded and mentions the extra count
- `roleUpdatedSummary("مدیر", 12)` contains the role name and the permission count

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 6: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

### Step 7: Confirm end to end

Start the dev server (`npm run dev`), log in with an account holding
`user.manage`, `role.manage`, `line.manage`, and `audit.view`, then perform each
of these and confirm a corresponding entry appears at `/admin/audit`:

1. Create a user → one `personnel` / `CREATE` entry, and **no password material
   anywhere in the row**
2. Edit that user and assign an access role → one `personnel` / `UPDATE` entry
   whose `changes` payload **includes `accessRoleId`**. This is the case plan
   013 unblocked; if `accessRoleId` is missing from the diff, plan 013 has not
   landed — STOP and report.
3. Reset that user's password → one entry, summary only, no hash in `changes`
4. Edit a role's permission list → one `accessRole` / `UPDATE` entry whose diff
   shows the old and new `permissions` JSON
5. Create and then edit a line → two `line` entries
6. Select two users and bulk-change their shift → **one** entry naming both ids,
   not two entries

**Verify**: all six. Record what you observed, especially (2) and (6).

## Test plan

- New file: `src/lib/__tests__/audit-summaries.test.ts` — roughly 8 cases per
  Step 5.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` — explicit
  `import { describe, it, expect } from "vitest"`, English test names, Persian
  string fixtures.
- The `audit()` calls themselves are not unit-tested: every one of the 18 sites
  requires Prisma and a session, and this repo has no database test harness
  (plan 001 deferred one deliberately). They are verified by the `grep` counts
  per step and the end-to-end walk in Step 7.
- The highest-value assertion is the password-material one — it is the only
  thing standing between a summary builder and a credential in a table that
  `audit.view` holders can read.
- Verification: `npm run test:run` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "await audit(" src/app/actions/user.ts` returns 9
- [ ] `grep -c "await audit(" src/app/actions/role.ts` returns 3
- [ ] `grep -c "await audit(" src/app/actions/line.ts` returns 6
- [ ] `test -f src/lib/audit-summaries.ts` succeeds; `grep -c "^import" src/lib/audit-summaries.ts` returns 0
- [ ] In every action ending in `redirect(`, the `await audit(` line precedes it —
      verified per action with the `awk` command shown in Steps 2–4
- [ ] `awk '/^export async function saveLinePositions/,/^}/' src/app/actions/line.ts | grep -c "await audit("` returns 1
- [ ] No password material in any audit argument:
      `grep -n "audit(" -A5 src/app/actions/user.ts | grep -ciE "\bhash\b|\bpassword\b"` returns 0
- [ ] `src/lib/audit.ts` is unmodified: `git diff --name-only` does not list it
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new summary cases
- [ ] `npm run build` exits 0
- [ ] All six Step 7 observations recorded
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 014 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- **Plan 013 has not landed.** Check first:
  `grep -c "isRelation" src/lib/audit.ts` must return at least 2. If it returns
  0, stop — this plan's central record (access-role assignment) would be written
  incomplete. Do not proceed and do not fix `computeDiff` yourself.
- Step 7 case (2) shows an `accessRoleId` change missing from the diff even
  though 013 has landed. Report the observed `changes` payload.
- Any of the six `redirect()`-ending actions stops navigating after your change.
  That means `audit()` ended up after the `redirect` or inside a `catch` that
  swallowed the control-flow throw.
- You find yourself changing a permission check, a hierarchy check, or any
  validation. This plan adds recording only; behaviour must be identical.
- You are tempted to fix the missing `isRoleAllowedToManage` guard in
  `bulkDeleteUsers`, `bulkUpdateUserShift`, or `bulkUpdateUserOrgPosition`. It is
  a real and more serious bug, and it is plan 016's. Report it, leave it.
- An audit call needs to go inside a Prisma `$transaction`. None should — every
  write here is a single statement.

## Maintenance notes

- **The rule this plan establishes: every mutating action in
  `src/app/actions/` writes an `AuditLog` row.** After this lands, the remaining
  gaps are `auth.ts` (login/logout, deliberately deferred — see below),
  `dashboard.ts` (plan 008 adds it for shared scopes), `settings.ts` (personal
  preferences, arguably noise), `notification.ts` (read receipts, noise),
  `report.ts`, and `tickets.ts` (which has its own `TicketHistory` model). A
  reviewer adding a new action should treat a missing `audit()` call as an
  omission, not a choice.
- **Bulk actions write one row, not N.** That is deliberate — per-record
  auditing of a 500-row import would also fire 500 SSE emissions through
  `src/lib/audit.ts:77`. The tradeoff is that a bulk change is less granular in
  the log; the id list in the summary is the mitigation, capped at 20.
- `saveLinePositions` auditing is the one entry here likely to be noise. It
  fires on depot-map drag-and-drop. If the log fills with layout rows, delete
  that single call rather than making it per-line.
- **Login and logout remain unaudited.** `src/app/actions/auth.ts` has no
  `audit()` call, so there is no record of successful sign-ins and no record of
  failed attempts. That is a genuine gap, deliberately excluded here because it
  raises questions this plan cannot answer alone: retention volume, whether to
  log failures (and thus near-miss credentials), and whether to add lockout.
  Worth its own plan.
- A reviewer should scrutinise: that no `resetPassword` code path passes
  `targetUser`, `hash`, or `password` into `audit()`, and that the six
  `redirect()`-ending actions still navigate.
