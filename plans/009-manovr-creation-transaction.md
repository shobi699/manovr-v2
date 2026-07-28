# Plan 009: Make manovr creation atomic so line capacity cannot be exceeded

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

Recording a manovr does two things that must agree: it writes a `Manovr` row
describing a train movement, and it updates the `Train` row to say where the
train now is. In between, it checks that the destination line has room.

Today those are four separate database statements with nothing binding them
together:

1. read the destination `Line` (for its `capacity`)
2. `count` the trains currently on it
3. `create` the `Manovr`
4. `update` the `Train`'s `lineId` and `slotIndex`

Two failure modes follow. **Concurrent dispatch**: two shift operators sending
different trains to the same line both run step 2 before either runs step 4,
both see room, and both proceed — the line ends up over capacity, which in a
rail depot is a physical-world claim the system is now wrong about. **Partial
write**: if step 4 throws, step 3 has already committed, so a `Manovr` record
exists asserting a movement that never happened to the train.

This is a small fix — Prisma has an interactive transaction API and the four
statements are adjacent — but it is worth doing precisely because the data it
protects is an operational record of physical train positions.

The window is genuinely small and this is a single-terminal SQLite deployment,
so the concurrency arm is unlikely rather than impossible. The partial-write arm
needs no concurrency at all.

## Current state

### `src/app/actions/manovr.ts:10-116` — `createManovr` in full

```ts
export async function createManovr(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };
  if (!(await hasPerm(session, "manovr.create")))
    return { error: "دسترسی ندارید. شما اجازه ثبت مانور را ندارید." };

  const type = Number(fd.get("type"));
  const trainId = Number(fd.get("trainId"));
  const destRaw = fd.get("destinationLineId");
  const sourceRaw = fd.get("sourceLineId");
  const rahbar1Id = Number(fd.get("rahbar1Id"));
  const rahbar2Raw = fd.get("rahbar2Id");
  const rahbar2Id = rahbar2Raw ? Number(rahbar2Raw) : null;
  const slotIndex = fd.get("slotIndex") ? Number(fd.get("slotIndex")) : 0;
  const description = String(fd.get("description") ?? "").trim() || null;
  const executionTimeRaw = fd.get("executionTime");
  const executionTime = executionTimeRaw ? new Date(String(executionTimeRaw)) : new Date();

  if (!type) return { error: "لطفا نوع مانور را انتخاب کنید." };
  if (!trainId) return { error: "لطفا قطار را انتخاب نمایید." };
  if (!rahbar1Id) return { error: "لطفا راهبر ۱ را انتخاب نمایید." };

  // دریافت اطلاعات قطار برای تعیین خط فعلی
  const train = await prisma.train.findUnique({ where: { id: trainId } });
  if (!train) return { error: "قطار مورد نظر یافت نشد." };

  let sourceLineId = sourceRaw ? Number(sourceRaw) : train.lineId;
  let destinationLineId = destRaw ? Number(destRaw) : (sourceLineId || train.lineId);

  if (!destinationLineId) return { error: "لطفا مقصد را انتخاب نمایید." };
  if (!sourceLineId) sourceLineId = destinationLineId;

  // بررسی ظرفیت خط مقصد (بدون احتساب خود این قطار اگر روی همان خط است)
  const dest = await prisma.line.findUnique({ where: { id: destinationLineId } });
  if (!dest) return { error: "خط مقصد نامعتبر است." };
  const onDest = await prisma.train.count({
    where: {
      lineId: destinationLineId,
      isDisposed: false,
      id: { not: trainId },
    },
  });
  if (onDest >= dest.capacity)
    return { error: "ظرفیت خط مقصد پر شده است." };

  const created = await prisma.manovr.create({
    data: {
      type,
      status: 1,
      confirmationStatus: 3,
      description,
      sourceLineId,
      destinationLineId,
      trainId,
      rahbar1Id,
      rahbar2Id,
      creatorId: session.id,
      executionTime,
    },
    include: {
      train: true,
      sourceLine: true,
      destinationLine: true,
    }
  });

  // به‌روزرسانی خط و اسلات قطار (در صورت مانور در تعویض کفشک نوع 20، پرچم کفشک قطار نیز فعال/به‌روز می‌شود)
  const trainUpdateData: { lineId: number; slotIndex: number; hasKafshak?: boolean } = {
    lineId: destinationLineId,
    slotIndex,
  };
  if (type === 20) {
    trainUpdateData.hasKafshak = true;
  }

  await prisma.train.update({
    where: { id: trainId },
    data: trainUpdateData,
  });

  // ثبت لاگ وقایع
  const trainCode = created.train?.code || String(trainId);
  const srcName = created.sourceLine?.name || "نامشخص";
  const destName = created.destinationLine?.name || "نامشخص";
  const isSameLine = sourceLineId === destinationLineId;
  const auditMessage = isSameLine
    ? `مانور در محل (ثابت) برای قطار ${trainCode} روی خط ${destName} ثبت گردید.`
    : `مانور جدیدی برای قطار ${trainCode} از خط ${srcName} به خط ${destName} ثبت گردید.`;

  await audit(
    session,
    "manovr",
    created.id,
    "CREATE",
    null,
    created,
    auditMessage
  );

  revalidatePath("/manovrs");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  redirect("/manovrs");
}
```

Several details that constrain the fix:

- **The capacity check excludes the moving train** (`id: { not: trainId }` at
  line 52). That is correct for an in-place manovr where source and destination
  are the same line, and it must be preserved exactly.
- **`type === 20` sets `hasKafshak`** (lines 84-86). A domain rule; keep it.
- **`redirect("/mano vrs")` at line 115.** In Next.js, `redirect()` works by
  throwing a special control-flow error. It must stay **outside** any
  `try`/`catch` and outside the transaction callback — otherwise the transaction
  sees the redirect signal as a failure and rolls back, or a `catch` swallows
  it and the redirect silently stops working. This is the single most likely way
  to break this action.
- **`audit(...)` at line 102** writes an `AuditLog` row, creates notifications,
  and emits an SSE event (`src/lib/audit.ts:61-77`). It must run **after** the
  transaction commits — auditing a rolled-back write would be wrong, and the SSE
  emit would tell every client to refresh to a state that does not exist.
- **`created` is returned with three relations included** (lines 72-76) and the
  audit message is built from them (lines 94-100). The transaction must return
  that object so the message can still be built afterwards.

### `prisma/schema.prisma:93-114` — `Line.capacity`

```prisma
model Line {
  id        Int     @id @default(autoincrement())
  name      String
  tag       String?
  capacity  Int     @default(1)
```

### `prisma/schema.prisma:117-138` — the `Train` fields being written

```prisma
model Train {
  id          Int     @id @default(autoincrement())
  code        String
  type        Int     @default(0) // 0=AC مترویی، 1=DC دیزلی
  isDisposed  Boolean @default(false)
  lineTag     String?
  lineId      Int?
  line        Line?   @relation(fields: [lineId], references: [id])
  slotIndex   Int     @default(0) // جایگاه پارک روی خط
  status      Int     @default(1)

  hasKafshak  Boolean @default(false) // وجود کفشک
```

### The datasource — `prisma/schema.prisma:6-9`

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

SQLite serialises writes at the database level, which is why this bug has
probably never been observed. It does **not** make the read-then-write sequence
atomic: the `count` in step 2 is a separate transaction from the `update` in
step 4, so two interleaved requests can still both observe room.

### The transaction pattern — none exists yet

```bash
grep -rn "\$transaction" src/
```

Expected: no matches. This plan introduces the first use, so there is no
in-repo exemplar to match. Follow the shape given in Step 2.

### A sibling site, deliberately out of scope

`src/app/actions/train.ts:138-172` (`relocateTrainDirectly`) moves a train
between lines from the depot map with **no capacity check at all**. That is a
separate gap; see Maintenance notes.

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
- `src/app/actions/manovr.ts` — `createManovr` only
- `src/lib/manovr-rules.ts` (create — the extracted capacity predicate)
- `src/lib/__tests__/manovr-rules.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `finishManovr`, `confirmManovr`, `deleteManovr` in the same file. Each is a
  single `update` preceded by a read for the audit `before` value. Not atomic
  either, but a stale `before` only affects the audit diff, not the record.
- `src/app/actions/train.ts` — including `relocateTrainDirectly`, which has the
  same missing capacity check. Adding it there is a behaviour change to the
  depot drag-and-drop and needs its own decision.
- `prisma/schema.prisma`. No constraint, index, or column change is needed.
- The `audit(...)` call's arguments and the Persian message construction.
- The validation block at lines 19-33 and the source/destination defaulting at
  lines 39-43. Confusing, but correct and out of scope.

## Git workflow

- Branch: `advisor/009-manovr-creation-transaction`
- Plain imperative commit subjects, e.g. `Wrap manovr creation in a transaction`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the capacity predicate so it can be tested

Create `src/lib/manovr-rules.ts`:

```ts
// قواعد دامنه‌ی مانور — بدون وابستگی به دیتابیس تا قابل تست باشند

/**
 * آیا خط مقصد ظرفیت پذیرش این قطار را دارد؟
 *
 * @param occupantCount تعداد قطارهای اسقاط‌نشده روی خط مقصد، بدون احتساب خود این قطار
 * @param capacity ظرفیت خط مقصد
 */
export function hasRoomOnLine(occupantCount: number, capacity: number): boolean {
  return occupantCount < capacity;
}

/**
 * مانور نوع ۲۰ (تعویض کفشک) پرچم کفشک قطار را فعال می‌کند
 */
export const KAFSHAK_MANOVR_TYPE = 20;

export function shouldSetKafshak(manovrType: number): boolean {
  return manovrType === KAFSHAK_MANOVR_TYPE;
}
```

`hasRoomOnLine(onDest, dest.capacity)` is the exact inverse of the current
`onDest >= dest.capacity` at `src/app/actions/manovr.ts:55`. Keep it that way —
this step must not change the boundary. A line with `capacity: 1` and zero
occupants has room; with one occupant it does not.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "^import" src/lib/manovr-rules.ts` → 0 (pure module, no imports)

### Step 2: Wrap the capacity check through the train update in one transaction

In `src/app/actions/manovr.ts`, replace lines 45-91 — from the
`// بررسی ظرفیت خط مقصد` comment through the `prisma.train.update` call — with a
single interactive transaction. Target shape:

```ts
  // بررسی ظرفیت و ثبت مانور و جابجایی قطار باید اتمیک باشند تا دو مانور همزمان
  // نتوانند هر دو از یک ظرفیت باقیمانده عبور کنند
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const dest = await tx.line.findUnique({ where: { id: destinationLineId } });
      if (!dest) throw new ManovrError("خط مقصد نامعتبر است.");

      // بدون احتساب خود این قطار، تا مانور در محل مسدود نشود
      const onDest = await tx.train.count({
        where: {
          lineId: destinationLineId,
          isDisposed: false,
          id: { not: trainId },
        },
      });
      if (!hasRoomOnLine(onDest, dest.capacity)) {
        throw new ManovrError("ظرفیت خط مقصد پر شده است.");
      }

      const manovr = await tx.manovr.create({
        data: {
          type,
          status: 1,
          confirmationStatus: 3,
          description,
          sourceLineId,
          destinationLineId,
          trainId,
          rahbar1Id,
          rahbar2Id,
          creatorId: session.id,
          executionTime,
        },
        include: {
          train: true,
          sourceLine: true,
          destinationLine: true,
        },
      });

      const trainUpdateData: { lineId: number; slotIndex: number; hasKafshak?: boolean } = {
        lineId: destinationLineId,
        slotIndex,
      };
      if (shouldSetKafshak(type)) {
        trainUpdateData.hasKafshak = true;
      }

      await tx.train.update({
        where: { id: trainId },
        data: trainUpdateData,
      });

      return manovr;
    });
  } catch (err) {
    if (err instanceof ManovrError) return { error: err.message };
    throw err;
  }
```

Define `ManovrError` at module scope, above `createManovr`:

```ts
// خطای دامنه‌ای که باید به پیام کاربر تبدیل شود، نه خطای ۵۰۰
class ManovrError extends Error {}
```

Four requirements that are easy to get wrong:

1. **Every query inside the callback uses `tx`, not `prisma`.** A stray
   `prisma.` inside the callback runs outside the transaction and defeats the
   whole change. Grep for it in Step 3.
2. **Validation failures become thrown `ManovrError`s.** Returning an error
   object from inside the callback would commit the transaction. Throwing rolls
   it back; the `catch` converts it to the same
   `{ error: "..." }` shape the action returned before, so callers see no
   change.
3. **The `catch` rethrows anything that is not a `ManovrError`.** A genuine
   database failure must not be reported to the user as a validation message.
4. **The transaction returns the `manovr` object with its three relations**, so
   the audit message construction at the current lines 94-100 keeps working
   unchanged against `created`.

Add the import:

```ts
import { hasRoomOnLine, shouldSetKafshak } from "@/lib/manovr-rules";
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "prisma.manovr.create\|prisma.train.update" src/app/actions/manovr.ts`
  → no matches inside `createManovr` (the other actions in the file still use
  `prisma.manovr.update`; that is expected)

### Step 3: Confirm `audit` and `redirect` stayed outside the transaction

This is a verification step, not an edit. Read the resulting `createManovr` top
to bottom and confirm the ordering:

1. session + permission checks
2. form parsing and validation
3. `prisma.train.findUnique` for the source line (**outside** the transaction —
   it only informs defaulting, and pulling it in would widen the transaction for
   no benefit)
4. the `$transaction` block
5. the `catch` that maps `ManovrError` to `{ error }`
6. `audit(...)` — **after** the commit
7. the three `revalidatePath` calls
8. `redirect("/manovrs")` — **last, outside any `try`/`catch`**

**Verify**, mechanically:

```bash
awk '/export async function createManovr/,/^}/' src/app/actions/manovr.ts | grep -n "transaction\|audit(\|redirect("
```

The line numbers must come out in that order: `$transaction`, then `audit(`,
then `redirect(`.

Also confirm no `tx.` reference escapes the callback and no `prisma.` reference
appears inside it:

```bash
awk '/\$transaction\(async \(tx\)/,/^  \}\);/' src/app/actions/manovr.ts | grep -n "prisma\."
```

Expected: no matches.

### Step 4: Write the rule tests

Create `src/lib/__tests__/manovr-rules.test.ts`.

Required cases for `hasRoomOnLine` — the boundary is the whole point:
- `hasRoomOnLine(0, 1)` is `true` — an empty capacity-1 line accepts a train
- `hasRoomOnLine(1, 1)` is `false` — a full capacity-1 line does not
- `hasRoomOnLine(2, 1)` is `false` — already over capacity stays refused
- `hasRoomOnLine(3, 5)` is `true`
- `hasRoomOnLine(0, 0)` is `false` — a zero-capacity line never accepts

Required cases for `shouldSetKafshak`:
- `shouldSetKafshak(20)` is `true`
- `shouldSetKafshak(19)` and `shouldSetKafshak(21)` are `false`
- `shouldSetKafshak(0)` is `false`

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 5: Confirm at runtime

Start the dev server (`npm run dev`) and log in with an account holding
`manovr.create`.

1. **Happy path**: record a manovr moving a train to a line with spare capacity.
   Confirm the `Manovr` row is created, the train appears on the destination
   line in `/depot`, and the browser lands on `/manovrs` — the redirect still
   works, which is the regression this step exists to catch.
2. **In-place manovr**: record a manovr whose source and destination are the
   same line, for a train already on a line at full capacity. Confirm it is
   **accepted** — the `id: { not: trainId }` exclusion must still hold. This is
   the case most likely to regress.
3. **Capacity refusal**: send a train to a line already at capacity. Confirm
   the Persian error «ظرفیت خط مقصد پر شده است.» appears, no `Manovr` row is
   created, and the train has not moved.
4. **Kafshak rule**: record a type-20 manovr and confirm the train's
   `hasKafshak` flag is set.

**Verify**: all four behave as described. (2) and (3) are the ones that catch a
botched transaction; (1) is the one that catches a botched redirect.

Record each outcome in your report.

### Step 6: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/manovr-rules.test.ts` — 8 cases per Step 4,
  concentrated on the capacity boundary.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, English test
  names.
- **The transaction itself is not unit-tested**, and no test proves the
  concurrency fix. Doing so needs a real database, two concurrent connections,
  and controlled interleaving — none of which this repo has (plan 001
  deliberately deferred a database test harness). The atomicity is verified by
  reading the code in Step 3 and by the behavioural checks in Step 5. Say so in
  your report rather than implying coverage that does not exist.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f src/lib/manovr-rules.ts` succeeds
- [ ] `grep -c "^import" src/lib/manovr-rules.ts` returns 0
- [ ] `grep -n "\$transaction" src/app/actions/manovr.ts` returns a match
- [ ] The awk check in Step 3 shows `$transaction` before `audit(` before `redirect(`
- [ ] The awk check in Step 3 finds no `prisma.` inside the transaction callback
- [ ] `grep -n "id: { not: trainId }" src/app/actions/manovr.ts` returns a match
      (the in-place exclusion survived)
- [ ] `prisma/schema.prisma` and `src/app/actions/train.ts` are unmodified:
      `git diff --name-only` lists neither
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the 8 new rule cases
- [ ] `npm run build` exits 0
- [ ] All four Step 5 outcomes recorded
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 009 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- After your change, submitting the manovr form no longer navigates to
  `/manovrs`. That means `redirect()` ended up inside the transaction or inside
  a `catch` — it throws a control-flow signal and must be outside both. Fix the
  placement; if it still misbehaves, report.
- Step 5 case (2) — the in-place manovr on a full line — is now rejected. The
  `id: { not: trainId }` exclusion was lost. Restore it exactly.
- The transaction times out. Prisma's interactive transactions have a default
  5-second limit; four small statements should be nowhere near it. A timeout
  means something long-running got pulled inside the callback — report what.
- You find that `audit(...)` must run inside the transaction for some reason.
  It must not: it writes notifications and emits an SSE broadcast
  (`src/lib/audit.ts:74-77`) that would announce a state that may roll back.
- You are tempted to also add a capacity check to
  `src/app/actions/train.ts:138` (`relocateTrainDirectly`). It is a real gap and
  it is deliberately not in this plan — report it instead.

## Maintenance notes

- **The invariant: the capacity check and the train move must stay in the same
  transaction.** Reading `count` outside and writing inside re-opens the exact
  race this plan closes. If someone later extracts the capacity check into a
  helper that takes `prisma` rather than `tx`, the guarantee is silently gone —
  that is what a reviewer should look for.
- `redirect()` and `audit()` placement is load-bearing and non-obvious. The
  ordering assertion in Step 3 is worth keeping as a review checklist item, not
  just a one-time check.
- `src/app/actions/train.ts:138-172` (`relocateTrainDirectly`) moves trains
  between lines from the depot map with **no capacity check at all** — so the
  invariant this plan protects can still be violated through a different door.
  That is a known, deliberate exclusion: adding a check there changes drag-and-
  drop behaviour operators rely on, and needs a product decision about whether
  an override is allowed. Worth its own plan.
- `finishManovr`, `confirmManovr`, and `deleteManovr` read a `before` row and
  then update, unguarded. The consequence is limited to a stale audit diff, not
  a wrong record, which is why they were left alone. If audit fidelity ever
  matters more, they are the next candidates.
- The `type === 20` kafshak rule is now named (`KAFSHAK_MANOVR_TYPE` in
  `src/lib/manovr-rules.ts`). Other bare manovr-type numbers remain scattered
  through the codebase; consolidating them into that module is a reasonable
  follow-up.
