# Plan 013: Record null transitions in the audit diff

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
> **Drift check (run first)**: `git diff --stat <planned-at SHA>..HEAD -- src/lib/audit.ts src/lib/__tests__/audit.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `893b103`, 2026-07-29

## Why this matters

`computeDiff` builds the `changes` payload for every row in the `AuditLog`
table. It skips relation fields with a `typeof === "object"` guard — but
`typeof null === "object"` in JavaScript, so the guard also swallows every
scalar field whose value is `null` on **either** side of the change.

The practical effect: setting a nullable column for the first time, or clearing
it, leaves **no trace in the audit log**. The row is still written; the field is
simply missing from `changes`, indistinguishable from a field that did not
change.

This schema is full of nullable columns, and some of them matter:

- `Personnel.accessRoleId` — granting a user their first custom access role is
  `null → 5`. **Not recorded.** Revoking it is `5 → null`. **Also not
  recorded.** This is the privilege-granting field in the permission system.
- `Train.lineId` — parking a train on a line for the first time.
- `Ticket.assigneeId` — first assignment of a support ticket.
- `Manovr.finishedAt` — the moment a manovr is closed.
- `Personnel.phone1`, `phone2`, `internalTel`, `address`, `personnelCode`,
  `avatarColor`, `userName` — every optional contact field, on first entry.

An audit log that silently omits privilege grants is worse than no audit log,
because it looks complete.

Plan 001 pinned this behaviour with a characterization test rather than fixing
it, because changing what gets written to the audit log is a behaviour change
that deserves its own review. This is that review.

## Current state

### The bug — `src/lib/audit.ts:6-27`

```ts
export function computeDiff(before: any, after: any) {
  const diff: Record<string, { old: any; new: any }> = {};

  const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));

  const ignoreKeys = ["createdAt", "updatedAt", "passwordHash", "id"];

  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;
    // بررسی فیلدهای رابطه‌ای (آبجکت‌ها یا آرایه‌ها)
    if (typeof before?.[key] === "object" || typeof after?.[key] === "object") continue;

    const oldVal = before?.[key];
    const newVal = after?.[key];

    if (oldVal !== newVal) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return diff;
}
```

Line 16 is the defect.

### Measured behaviour, verified by direct reproduction

```
computeDiff({ phone1: null },   { phone1: "0912" })   ->  {}                              ← dropped
computeDiff({ phone1: "0912" }, { phone1: null })     ->  {}                              ← dropped
computeDiff({ phone1: "0912" }, { phone1: "0913" })   ->  { phone1: {old,new} }           ← correct
computeDiff(null, { phone1: "0912", role: 2 })        ->  both keys present               ← correct
computeDiff({passwordHash:"a",role:1},{passwordHash:"b",role:2}) -> { role: {...} } only  ← correct
```

The CREATE path is unaffected because when `before` is entirely `null`,
`before?.[key]` evaluates to `undefined` (not `null`), and
`typeof undefined === "undefined"`.

### What the guard is actually for

It exists to skip Prisma **relation** objects. Several `audit()` callers pass
records fetched with `include`, so the object carries nested relations
alongside its scalars — for example `src/app/actions/manovr.ts` passes a
`created` record with `train`, `sourceLine`, and `destinationLine` included.
Diffing those nested objects would be meaningless (and `oldVal !== newVal` on
two object references is always true, so every one would appear as a bogus
change). Arrays likewise.

So the guard must keep excluding objects and arrays. It must stop excluding
`null`.

### The characterization test to flip — `src/lib/__tests__/audit.test.ts`

Plan 001 left this in place, deliberately failing-when-fixed:

```ts
  // رفتار فعلی (باگ‌دار) — عمداً ثبت شده تا تغییرات آینده قابل تشخیص باشد.
  it("CHARACTERIZATION (known bug): drops changes where either side is null", () => {
    expect(computeDiff({ phone1: null }, { phone1: "0912" })).toEqual({});
    expect(computeDiff({ phone1: "0912" }, { phone1: null })).toEqual({});
  });

  it.todo(
    "should record null -> value and value -> null transitions " +
      "(blocked on fixing the typeof-null guard in src/lib/audit.ts:16)"
  );
```

Both must be replaced in this plan — the characterization test will fail once
the bug is fixed, which is exactly what it was for.

### The `audit()` callers whose records will change shape

26 `await audit(...)` call sites across `src/app/actions/backup.ts`,
`lookups.ts`, `manovr.ts`, `profile.ts`, `scheduled-report.ts`, `train.ts`, and
`src/lib/backup.ts`, `src/lib/scheduler.ts`. None needs modification — they all
pass `before`/`after` records and let `computeDiff` decide. Their audit rows
will simply start containing fields that were previously missing.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Install   | `npm install`              | exit 0              |
| Generate Prisma client | `npx prisma generate` | exit 0        |
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/lib/audit.ts` — `computeDiff` only
- `src/lib/__tests__/audit.test.ts` — replace the characterization test

**Out of scope** (do NOT touch, even though they look related):
- Any of the 26 `audit()` call sites. They pass records and let `computeDiff`
  decide; none needs a change.
- The `ignoreKeys` array. `passwordHash` must stay in it — plan 003 depends on
  that, and plan 001 has a regression test pinning it.
- `handleAutoNotifications` in the same file. Unrelated.
- Adding audit coverage to `src/app/actions/user.ts`, `role.ts`, or `line.ts`.
  That is a separate, larger finding — see plan 014. **This plan must land
  first**, because assigning an access role is exactly a `null → value`
  transition, and adding those audit calls before this fix would produce records
  that silently omit the field that matters most.
- The `AuditLog` table or any migration. Existing rows keep their shape; only
  newly written ones gain the missing fields.

## Git workflow

- Branch: `advisor/013-audit-diff-null-transitions`
- Plain imperative commit subject, e.g. `Record null transitions in audit diff`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the guard

In `src/lib/audit.ts`, replace line 16:

```ts
    if (typeof before?.[key] === "object" || typeof after?.[key] === "object") continue;
```

with a check that excludes objects and arrays but **not** `null`:

```ts
    // فیلدهای رابطه‌ای (آبجکت یا آرایه) نادیده گرفته می‌شوند، اما null یک مقدار
    // اسکالر معتبر است و باید ثبت شود — typeof null برابر "object" است و این
    // تله‌ای بود که باعث حذف خاموش تغییرات null می‌شد.
    const isRelation = (v: unknown) => v !== null && typeof v === "object";
    if (isRelation(before?.[key]) || isRelation(after?.[key])) continue;
```

Declare `isRelation` once **above** the `for` loop, not inside it.

Note the existing `?? null` normalisation on lines 22 is already correct and
should stay: it turns `undefined` into `null` so the recorded shape is
consistent.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n 'typeof before?.\[key\] === "object"' src/lib/audit.ts` → no matches
- `grep -n "isRelation" src/lib/audit.ts` → declaration plus one use

### Step 2: Flip the characterization test

In `src/lib/__tests__/audit.test.ts`, delete the
`CHARACTERIZATION (known bug)` test and the `it.todo` beside it, and replace
them with the real assertions:

```ts
  it("records a null -> value transition", () => {
    expect(computeDiff({ phone1: null }, { phone1: "0912" })).toEqual({
      phone1: { old: null, new: "0912" },
    });
  });

  it("records a value -> null transition", () => {
    expect(computeDiff({ phone1: "0912" }, { phone1: null })).toEqual({
      phone1: { old: "0912", new: null },
    });
  });

  it("records granting and revoking an access role", () => {
    // مورد امنیتی اصلی: اعطای نقش دسترسی سفارشی یک گذار null -> value است
    expect(computeDiff({ accessRoleId: null }, { accessRoleId: 5 })).toEqual({
      accessRoleId: { old: null, new: 5 },
    });
    expect(computeDiff({ accessRoleId: 5 }, { accessRoleId: null })).toEqual({
      accessRoleId: { old: 5, new: null },
    });
  });

  it("still skips relation objects and arrays", () => {
    const before = { name: "a", train: { id: 1, code: "AC-1" }, tags: ["x"] };
    const after = { name: "b", train: { id: 2, code: "AC-2" }, tags: ["y"] };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({ name: { old: "a", new: "b" } });
    expect(diff).not.toHaveProperty("train");
    expect(diff).not.toHaveProperty("tags");
  });

  it("does not record a null -> null non-change", () => {
    expect(computeDiff({ phone1: null }, { phone1: null })).toEqual({});
  });
```

The `still skips relation objects and arrays` case is the important one — it is
what stops a future "simplification" from removing the guard entirely and
flooding every audit row with meaningless object diffs.

Leave every other test in the file untouched, especially the `passwordHash`
exclusion test.

**Verify**: `npm run test:run` → exit 0, all pass, **zero** `todo` entries
remaining in `audit.test.ts`.

### Step 3: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

### Step 4: Confirm the change end to end

Start the dev server (`npm run dev`), log in as an account that can edit a
personnel record, and:

1. Pick a user whose `phone1` is empty and set it. Then open
   `/admin/audit` (needs the `audit.view` permission) and confirm the entry
   shows `phone1` changing from empty to the new value. Before this plan, that
   change produced an audit row with an **empty** `changes` payload.
2. Clear the same field again and confirm the reverse transition is recorded.

`src/app/actions/profile.ts:35-43` is a convenient path — `updateUserProfile`
audits with full before/after records and writes exactly these nullable contact
fields.

**Verify**: both transitions appear in the audit log. Record what you observed.

## Test plan

- Modified: `src/lib/__tests__/audit.test.ts` — remove the characterization test
  and the `it.todo`; add the 5 cases in Step 2.
- Structural pattern: the file already exists from plan 001 — match its
  existing style exactly.
- The most valuable new test is `still skips relation objects and arrays`. The
  fix narrows a guard, and the failure mode of narrowing it too far is silent
  and noisy at the same time — every audit row filling with object references.
- Verification: `npm run test:run` → exit 0, no `todo` entries in this file.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n 'typeof before?.\[key\] === "object"' src/lib/audit.ts` returns no matches
- [ ] `grep -n "isRelation" src/lib/audit.ts` returns a declaration and a use
- [ ] `grep -n "passwordHash" src/lib/audit.ts` still shows it in `ignoreKeys`
- [ ] `grep -c "CHARACTERIZATION\|it.todo" src/lib/__tests__/audit.test.ts` returns 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, all pass, no todo entries
- [ ] `npm run build` exits 0
- [ ] Step 4 observations recorded
- [ ] `git status --porcelain` lists only the two In-scope files
- [ ] `plans/README.md` status row for 013 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpt under "Current state" no longer matches `src/lib/audit.ts`.
- The `passwordHash` exclusion test from plan 001 starts failing. That would
  mean the guard change affected `ignoreKeys` handling, which it must not —
  `ignoreKeys` is checked on the line above and is untouched by this plan.
- Any existing test outside `audit.test.ts` starts failing. Nothing else should
  depend on `computeDiff`'s output shape; if something does, report what.
- Audit rows start containing nested relation objects after your change. That
  means `isRelation` is too permissive — report the observed payload.
- You find a caller that depends on a field being **absent** from `changes`.
  Search `grep -rn "\.changes" src/` first. Expected: `AuditLog.changes` is
  written in `src/lib/audit.ts` and read for display in
  `src/app/(main)/admin/audit/`. Anything that branches on a field's absence is
  a real interaction — report before proceeding.

## Maintenance notes

- **`typeof null === "object"` is the whole bug.** Any future guard that
  classifies values by `typeof` alone will reintroduce it. The `isRelation`
  helper exists to make the `!== null` check impossible to drop accidentally;
  keep it as a named function rather than inlining the condition back.
- Existing `AuditLog` rows written before this fix are permanently missing their
  null transitions. There is no backfill — the source data is gone. If audit
  completeness matters for a specific past period, that is a data question, not
  a code one.
- This plan is a prerequisite for **plan 014** (adding audit coverage to
  `user.ts`, `role.ts`, and `line.ts`). Assigning an access role is a
  `null → value` transition; landing 014 first would write audit rows that omit
  the single most security-relevant field in them.
- A reviewer should scrutinise: that the relation-skipping behaviour is intact
  (the dedicated test), and that `passwordHash` is still in `ignoreKeys`.
