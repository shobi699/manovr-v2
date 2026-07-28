# Plan 003: Stop sending every user's password hash to the browser

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

`Personnel.passwordHash` is a bcrypt hash of a real user's password
(`prisma/schema.prisma:17`). Two code paths currently serialize it, along with
every user's `userName`, into responses the browser receives:

1. **`/users`** fetches personnel rows with no `select` and hands them straight
   to a client component. In the App Router, props passed to a client component
   are serialized into the RSC flight payload — so the hashes travel over the
   wire and land in the browser. Worse, the page has no permission gate at all
   beyond "is logged in", so an account with role 0 and zero permissions can
   navigate there and collect them.
2. **The dynamic report builder** does the same for `entity: "personnel"`
   reports, returning full personnel rows from a server action to the client.
   The UI only *displays* safe columns, but the payload carries everything, and
   the server action is directly callable regardless of what the UI offers.

Bcrypt hashes are not plaintext, but they are offline-crackable, and a
low-privilege operator on a shared terminal should never hold the
super-admin's hash. This also means hashes sit in browser memory, in the
back/forward cache, and — if `passwordHash` is named as a report field — in
exported `.xlsx` and `.pdf` files.

The repository already has the correct pattern in
`src/app/(main)/phonebook/page.tsx`. This plan applies it to the two places
that skipped it.

## Current state

### Leak path 1 — `src/app/(main)/users/page.tsx:11-47`

```tsx
export default async function UsersPage() {
  const session = await getSession();
  if (!session) return null;

  const [currentUser, orgPosLookup, shiftLookup, roleLookup] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: session.id },
    }),
    getCachedLookup("org_position"),
    getCachedLookup("shift"),
    getCachedLookup("role"),
  ]);

  const orgPositions = orgPosLookup?.values || [];
  const shifts = shiftLookup?.values || [];
  const roles = roleLookup?.values || [];

  const isShiftSupervisor = currentUser?.orgPosition === 2;
  const canManageAll = await hasPerm(session, "user.manage");

  // اگر مسئول شیفت باشد، فقط پرسنل شیفت و نوع خودش را می‌بیند. در غیر این صورت همه را می‌بیند.
  const supervisor = currentUser as unknown as { shift: number; personnelType: number };
  const whereClause = isShiftSupervisor && currentUser
    ? {
        shift: supervisor.shift,
        personnelType: supervisor.personnelType,
      }
    : {};

  const people = await prisma.personnel.findMany({
    where: whereClause,
    orderBy: [{ hasAccount: "desc" }, { role: "asc" }, { firstName: "asc" }],
    include: { accessRole: true },
  });

  const accounts = people.filter((p) => p.hasAccount);
  const nonAccounts = people.filter((p) => !p.hasAccount);
```

Three problems in that block:

- Line 13: `if (!session) return null;` is the **only** gate. `canManageAll` is
  computed at line 29 but is only used to decide whether to show the "add user"
  button — it does not gate the data fetch or the page itself.
- Lines 16-18: `currentUser` is fetched with no `select`, so it too carries the
  caller's own hash.
- Lines 40-44: `findMany` with `include` and no `select` returns every column.

`accounts` and `nonAccounts` are then passed to the client component at
`src/app/(main)/users/page.tsx:123-125`:

```tsx
        <UsersTableClient
          accounts={accounts}
          nonAccounts={nonAccounts}
```

`UsersTableClient` is `"use client"` (`src/app/(main)/users/UsersTableClient.tsx:1`)
and types both props as `any[]` (`:17-18`), so TypeScript never objected.

### Which personnel fields the users page actually renders

`UsersTableClient` and its children read: `id`, `firstName`, `lastName`,
`userName`, `role`, `shift`, `orgPosition`, `personnelType`, `personnelCode`,
`hasAccount`, `phone1`, `phone2`, `internalTel`, `avatarColor`, `createdAt`,
`accessRoleId`, and `accessRole` (for the role name). It never reads
`passwordHash` or `address`.

Confirm this yourself before writing the whitelist:

```bash
grep -oE "\.(passwordHash|address|workPlace)\b" "src/app/(main)/users/UsersTableClient.tsx" "src/app/(main)/users/UserRowActions.tsx"
```

Expected: no matches. If there are matches, adjust the whitelist accordingly
and note it in your report.

### Leak path 2 — `src/lib/report-engine.ts:193-199`

```ts
  } else if (config.entity === "personnel") {
    records = await prisma.personnel.findMany({
      where,
      orderBy,
      include: { accessRole: true },
    });
  }
```

No `select`. Those records are returned to the client by
`src/app/actions/report.ts:11-23`:

```ts
export async function runDynamicReport(config: ReportConfig) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  try {
    const records = await executeReportQuery(config);
    return { records };
  } catch (err: any) {
    return { error: `خطا در اجرای گزارش: ${err.message}` };
  }
}
```

`report.build` is granted to legacy role 3 ("Viewer") — see
`src/lib/perms.ts:73`:

```ts
  3: ["manovr.view", "phonebook.view", "report.build", "report.export", "depot.view", "dashboard.view"],
```

So the lowest role with any access at all can pull every hash.

### `ReportConfig` and the client-supplied field list

`src/lib/report-engine.ts:10-18`:

```ts
export interface ReportConfig {
  entity: "manovr" | "train" | "line" | "personnel";
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  chart?: "table" | "bar" | "pie" | "line";
  sortField?: string;
  sortDirection?: "asc" | "desc";
}
```

`fields` comes from the client and is used verbatim by
`src/lib/export-helpers.ts:113` (`generateExcelBuffer`) and `:173`
(`generatePDFBuffer`), which resolve each name through `getVal`. `getVal`'s
fallback at `src/lib/export-helpers.ts:68` is:

```ts
  return item[col] ? String(item[col]) : "—";
```

So naming `passwordHash` as a field writes the hash into the exported file.

The UI's own personnel field list is at
`src/app/(main)/reports/ReportBuilderClient.tsx:50-62` and is already safe —
but the client is not the security boundary.

### The exemplar to follow — `src/app/(main)/phonebook/page.tsx:13-38`

```tsx
  const personnel = await prisma.personnel.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <>
      <div className="topbar">
        <h1>دفتر تلفن و دایرکتوری پرسنل</h1>
      </div>
      <div className="content">
        <PhonebookClient
          initialPersonnel={personnel.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            phone1: p.phone1 || "",
            phone2: p.phone2 || "",
            internalTel: p.internalTel || "",
            address: p.address || "",
            avatarColor: p.avatarColor || "#4b5563",
            shift: p.shift,
            orgPosition: p.orgPosition,
            personnelCode: p.personnelCode || "",
          }))}
```

Note: phonebook whitelists at the *mapping* step, not the query. Prefer doing
it at the **query** level with Prisma `select` where you can — the hash then
never enters the Node process at all. Fall back to mapping only where a query
`select` would be disruptive.

### The permission that should gate `/users`

`src/lib/perms.ts:22` defines `"user.manage"` — "مدیریت کاربران و پرسنل". The
standard gate shape used throughout the codebase is
`src/app/actions/user.ts:401-404`:

```ts
export async function bulkUpdateUserShift(ids: number[], shift: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
```

For a page (rather than an action) the convention is `redirect` — see
`src/app/(main)/layout.tsx:12-13`:

```tsx
  const session = await getSession();
  if (!session) redirect("/login");
```

### The shift-supervisor carve-out — do not break it

`src/app/(main)/users/page.tsx:28-38` gives users with `orgPosition === 2`
(مسئول شیفت / shift supervisor) a scoped view of their own shift's personnel,
independent of `user.manage`. That is deliberate product behaviour and must
survive this change: the page gate must admit **either** `user.manage`
**or** `isShiftSupervisor`.

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
- `src/app/(main)/users/page.tsx`
- `src/lib/report-engine.ts`
- `src/lib/__tests__/report-engine.test.ts` (extend — created by plan 001)
- `src/lib/__tests__/personnel-fields.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/app/(main)/users/UsersTableClient.tsx` and `UserRowActions.tsx`. Their
  props are typed `any[]`, so narrowing the data does not break compilation.
  If a runtime read of a field you removed shows up, widen the whitelist —
  do not restructure the component.
- `src/app/(main)/phonebook/page.tsx` — already correct; it is the exemplar.
- `src/app/(main)/reports/ReportBuilderClient.tsx` — the client field list is
  already safe and is not the boundary being fixed.
- `src/app/actions/report.ts` — the `hasPerm(session, "report.build")` gate
  there is correct. The fix belongs in the query, not the action.
- `src/lib/export-helpers.ts` — `getVal`'s behaviour is fine once the records
  handed to it no longer contain sensitive columns.
- Pagination. `src/app/(main)/users/page.tsx:40` is also an unbounded query;
  that is plan 010's job. Do not add `take`/`skip` here.

## Git workflow

- Branch: `advisor/003-personnel-field-whitelist`
- Plain imperative commit subjects, e.g. `Whitelist personnel fields on /users`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Define the shared personnel field allowlist

Add to `src/lib/report-engine.ts`, near the top with the other exports, a
single source of truth for which personnel columns may leave the server:

```ts
// ستون‌های مجاز پرسنل برای ارسال به کلاینت و خروجی گزارش‌ها.
// passwordHash عمداً حذف شده است و هرگز نباید اضافه شود.
export const PERSONNEL_SAFE_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "userName",
  "role",
  "shift",
  "orgPosition",
  "workPlace",
  "personnelType",
  "personnelCode",
  "hasAccount",
  "createdAt",
  "phone1",
  "phone2",
  "internalTel",
  "address",
  "avatarColor",
  "accessRoleId",
] as const;

export type PersonnelSafeField = (typeof PERSONNEL_SAFE_FIELDS)[number];

// شکل select برای Prisma بر اساس لیست مجاز بالا
export const PERSONNEL_SAFE_SELECT = Object.fromEntries(
  PERSONNEL_SAFE_FIELDS.map((f) => [f, true])
) as Record<PersonnelSafeField, true>;
```

Compare that list against `prisma/schema.prisma:12-51`. The complete `Personnel`
scalar set is: `id`, `firstName`, `lastName`, `userName`, `passwordHash`,
`role`, `shift`, `orgPosition`, `workPlace`, `personnelType`, `personnelCode`,
`hasAccount`, `createdAt`, `phone1`, `phone2`, `internalTel`, `address`,
`avatarColor`, `accessRoleId`. The allowlist above is that set minus
`passwordHash`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "passwordHash" src/lib/report-engine.ts` → matches only the comment,
  never a list entry

### Step 2: Apply the allowlist to the personnel report query

In `src/lib/report-engine.ts`, change the `personnel` branch at lines 193-199 to
use `select` instead of `include`. Prisma does not allow `select` and `include`
together, so the relation must move inside the `select`:

```ts
  } else if (config.entity === "personnel") {
    records = await prisma.personnel.findMany({
      where,
      orderBy,
      select: {
        ...PERSONNEL_SAFE_SELECT,
        accessRole: true,
      },
    });
  }
```

Leave the `manovr`, `train`, and `line` branches (lines 176-192) exactly as they
are — none of those models has a sensitive column.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "include: { accessRole: true }" src/lib/report-engine.ts` → no matches

### Step 3: Filter the client-supplied field list for personnel exports

Also in `src/lib/report-engine.ts`, add an exported helper that callers use to
sanitise `config.fields`:

```ts
// فیلدهای درخواستی کلاینت را برای موجودیت پرسنل به لیست مجاز محدود می‌کند
export function sanitizeReportFields(entity: string, fields: string[]): string[] {
  if (entity !== "personnel") return fields;
  return fields.filter((f) => (PERSONNEL_SAFE_FIELDS as readonly string[]).includes(f));
}
```

Then apply it where the field list is consumed. There are three call sites:

- `src/app/api/export/excel/route.ts:38` —
  `generateExcelBuffer(config.entity, config.fields, res.records, lookupsMap)`
- `src/app/api/export/pdf/route.ts:38` —
  `generatePDFBuffer(config.entity, config.fields, res.records, lookupsMap)`
- `src/lib/scheduler.ts:76` and `:78` — the scheduled-report path:

```ts
    if (sr.format === "pdf") {
      buffer = await generatePDFBuffer(config.entity, config.fields, records);
    } else {
      buffer = await generateExcelBuffer(config.entity, config.fields, records);
    }
```

Wrap the second argument at each site:
`sanitizeReportFields(config.entity, config.fields)`.

> These three files are **not** in the In-scope list above because the fix is a
> single-argument wrap per call. Make exactly that change and nothing else in
> them. If any of them needs more than a one-line edit, that is a STOP
> condition.

**Verify**:
- `grep -rn "sanitizeReportFields" src/app/api/export/ src/lib/scheduler.ts` → 4 matches
- `npx tsc --noEmit` → exit 0

### Step 4: Gate `/users` and whitelist its query

In `src/app/(main)/users/page.tsx`:

**4a — add the permission gate.** After line 29 (`const canManageAll = await
hasPerm(session, "user.manage");`) and after `isShiftSupervisor` is known,
redirect anyone who is neither:

```tsx
  if (!canManageAll && !isShiftSupervisor) {
    redirect("/depot");
  }
```

Import `redirect` from `next/navigation`. `/depot` is the post-login landing
route — see `src/app/actions/auth.ts:41` (`redirect("/depot")`). Note the
ordering constraint: `isShiftSupervisor` is derived from `currentUser`
(line 28), so the gate must come after the `Promise.all` at lines 15-22.

**4b — whitelist `currentUser`.** The page reads only `orgPosition`, `shift`,
and `personnelType` from it (lines 28, 35, 36). Narrow the query:

```tsx
    prisma.personnel.findUnique({
      where: { id: session.id },
      select: { id: true, orgPosition: true, shift: true, personnelType: true },
    }),
```

This also lets you delete the `as unknown as { shift: number; personnelType: number }`
cast at line 32, since the fields are now typed. Do that.

**4c — whitelist the `people` query.** Replace `include` with `select`:

```tsx
  const people = await prisma.personnel.findMany({
    where: whereClause,
    orderBy: [{ hasAccount: "desc" }, { role: "asc" }, { firstName: "asc" }],
    select: {
      ...PERSONNEL_SAFE_SELECT,
      accessRole: true,
    },
  });
```

Import `PERSONNEL_SAFE_SELECT` from `@/lib/report-engine`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "as unknown as" "src/app/(main)/users/page.tsx"` → no matches
- `grep -n "include: { accessRole: true }" "src/app/(main)/users/page.tsx"` → no matches
- `grep -n "redirect" "src/app/(main)/users/page.tsx"` → import plus the gate

### Step 5: Add regression tests

**5a — extend `src/lib/__tests__/report-engine.test.ts`** (created by plan 001)
with a new `describe` block for the allowlist:

- `PERSONNEL_SAFE_FIELDS` does not contain `"passwordHash"`
- `PERSONNEL_SAFE_SELECT` has no `passwordHash` key
- `sanitizeReportFields("personnel", ["firstName", "passwordHash"])` →
  `["firstName"]`
- `sanitizeReportFields("personnel", ["passwordHash"])` → `[]`
- `sanitizeReportFields("manovr", ["type", "anything"])` → unchanged
  (non-personnel entities pass through)

**5b — create `src/lib/__tests__/personnel-fields.test.ts`** with the guard
that matters most: the allowlist must stay in sync with the schema minus the
hash. Read `prisma/schema.prisma` from disk, extract the scalar field names of
the `Personnel` model, and assert:

- every name in `PERSONNEL_SAFE_FIELDS` exists in the schema (catches typos and
  stale entries after a rename)
- `passwordHash` is in the schema but **not** in `PERSONNEL_SAFE_FIELDS`
  (catches someone adding it back)

Sketch:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PERSONNEL_SAFE_FIELDS } from "@/lib/report-engine";

function personnelScalarFields(): string[] {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const block = schema.match(/model Personnel \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("Personnel model not found in prisma/schema.prisma");
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}
// ...
```

Relation fields (`accessRole`, `manovrsAsRahbar1`, …) will also appear in that
extraction; the "every allowlisted name exists in the schema" direction still
holds, and the `passwordHash` assertion is exact. Do not over-engineer the
parser — if it becomes fragile, keep only the `passwordHash` assertions and say
so in your report.

**Verify**: `npm run test:run` → exit 0, new cases pass.

### Step 6: Confirm the leak is closed at runtime

Start the dev server (`npm run dev`), log in, and open `/users` with an account
that has `user.manage`. Then in the browser devtools Network tab, find the
document/RSC response for `/users` and search its body for `$2b$` — the bcrypt
hash prefix used by `bcryptjs` (see `src/app/actions/user.ts`, which hashes with
`bcrypt.hash(..., 10)`).

**Verify**: no `$2b$` or `$2a$` occurrence in the `/users` response body.
Before this plan, that search matches once per account.

Then log in as an account with neither `user.manage` nor `orgPosition === 2` and
navigate to `/users`.

**Verify**: redirected to `/depot`, no personnel data in the response.

If you cannot obtain two accounts with different permissions, say so in your
report rather than skipping the check silently.

### Step 7: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- Extended: `src/lib/__tests__/report-engine.test.ts` — 5 new cases for
  `PERSONNEL_SAFE_FIELDS`, `PERSONNEL_SAFE_SELECT`, and `sanitizeReportFields`.
- New: `src/lib/__tests__/personnel-fields.test.ts` — schema-sync guard, 2–3
  cases.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, English test
  names, one `describe` per unit.
- The manual runtime check in Step 6 is not automated. There is no integration
  test harness in this repo (plan 001 explicitly deferred one), so record the
  result of the `$2b$` search in your report.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "passwordHash" src/app/ src/lib/report-engine.ts` returns only
      comment lines, never a field list or a query
- [ ] `grep -n "include: { accessRole: true }" src/lib/report-engine.ts "src/app/(main)/users/page.tsx"` returns no matches
- [ ] `grep -n "PERSONNEL_SAFE_SELECT" "src/app/(main)/users/page.tsx"` returns a match
- [ ] `grep -n "redirect(\"/depot\")" "src/app/(main)/users/page.tsx"` returns a match
- [ ] `grep -rn "sanitizeReportFields" src/app/api/export/ src/lib/scheduler.ts` returns 4 matches
- [ ] `grep -n "as unknown as" "src/app/(main)/users/page.tsx"` returns no matches
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new allowlist and schema-sync cases
- [ ] `npm run build` exits 0
- [ ] Step 6 recorded: no `$2b$`/`$2a$` in the `/users` response body
- [ ] `git status --porcelain` lists only the In-scope files plus the three
      one-line export call-site edits from Step 3
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- The `grep` in "Which personnel fields the users page actually renders" shows
  `UsersTableClient` or `UserRowActions` reading `passwordHash`. That would mean
  the component genuinely depends on it and the situation is worse than this
  plan assumes — report before changing anything.
- Adding `select` to the personnel queries produces a Prisma type error you
  cannot resolve by moving the relation inside `select`. Report the exact error.
- Any of the three export call sites in Step 3 needs more than a one-line change.
- You find a third code path returning unfiltered `Personnel` rows to a client.
  Search: `grep -rn "personnel.findMany\|personnel.findUnique\|personnel.findFirst" src/`.
  Known safe today: `src/app/(main)/phonebook/page.tsx:13` (maps to a
  whitelist), `src/app/actions/tickets.ts:17-25` (uses `select`),
  `src/app/(main)/reports/page.tsx:23` (uses `select`),
  `src/app/(main)/dashboard/page.tsx:58-61` (uses `select`),
  `src/app/(main)/depot/page.tsx:28-32` (uses `select`),
  `src/lib/perms.ts:82-85` (server-only, never returned to a client),
  `src/app/actions/auth.ts:20-25` and `src/app/actions/profile.ts:23,66` (server-only,
  the hash is needed for `bcrypt.compare`). Anything outside that list is new —
  report it.
- The runtime check in Step 6 still finds `$2b$` in the `/users` payload after
  your changes. Do not guess at another whitelist; report what field carries it.

## Maintenance notes

- `PERSONNEL_SAFE_FIELDS` in `src/lib/report-engine.ts` is now the single
  authority for which personnel columns may cross to a client. **Any new column
  added to the `Personnel` model must be consciously added there** — the
  schema-sync test in `src/lib/__tests__/personnel-fields.test.ts` will fail
  loudly if a name drifts, but it cannot tell you that a *newly added* sensitive
  column was wrongly allowlisted. Reviewers should treat additions to that array
  as security-relevant.
- The `/users` gate now admits `user.manage` **or** `orgPosition === 2`. That
  second arm is a raw field check, not a permission — it is part of the
  unfinished role→permission migration noted in `plans/README.md`. If that
  migration lands, the shift-supervisor carve-out should become a real
  permission and this gate should be revisited.
- `src/app/(main)/users/page.tsx:40` remains an unbounded `findMany`. Plan 010
  paginates it. Whoever does that must keep the `select` this plan added.
- A reviewer should scrutinise: that no `include:` without `select:` remains on
  a `Personnel` query reachable from a client, and that `sanitizeReportFields`
  is applied at *all three* call sites — Excel, PDF, and the scheduled-report
  path in `src/lib/scheduler.ts`. The scheduler one is easy to miss because it
  runs unattended.
- Deferred out of this plan: `src/app/actions/report.ts` returns records with no
  cap on row count. That is plan 010 territory, not a security fix.
