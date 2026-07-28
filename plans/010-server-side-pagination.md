# Plan 010: Move list-page filtering and pagination to the server

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
>
> **This is the largest plan in the set.** Read it end to end before starting.
> It is deliberately staged so the codebase works after every step; do not
> reorder the steps.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md
- **Category**: perf
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

Every list page in this application loads its entire table from the database on
every request and ships all of it to the browser, where `DataTable` does the
searching, sorting, and paging in JavaScript. The user sees ten rows; the server
sent all of them.

For most tables that is merely wasteful. For `/manovrs` it is a growing
liability: a manovr row is written for every train movement on every shift,
forever, and the query pulls each one with five joined relations
(`sourceLine`, `destinationLine`, `train`, `rahbar1`, `creator`). Page weight
and time-to-first-byte grow linearly with the depot's operating history. On this
deployment — SQLite, inside an Electron app on terminal hardware — that is the
first thing that will visibly degrade, and it degrades slowly enough that nobody
will connect it to a cause.

The dashboard has a smaller version of the same problem: it issues ten separate
`count` queries in a `for` loop to build a ten-day trend, one round trip each,
where a single grouped query would do.

The user asked for all four list pages, not just manovrs. `DataTable` is shared
by five clients, two of which are out of scope — so the shared component must
gain server-driven mode **without** breaking the two that keep using client-side
mode.

## Current state

### The four target pages

**`src/app/(main)/manovrs/page.tsx:18-31`** — the unbounded one:

```tsx
  const [manovrs, manovrTypeLookup, manovrStatusLookup, confirmationStatusLookup] = await Promise.all([
    prisma.manovr.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sourceLine: true,
        destinationLine: true,
        train: true,
        rahbar1: true,
        creator: true,
      },
    }),
```

No `take`, no `skip`, five relations.

**`src/app/(main)/trains/page.tsx:14-20`**:

```tsx
  const [trains, trainTypeLookup] = await Promise.all([
    prisma.train.findMany({
      orderBy: { code: "asc" },
      include: { line: true },
    }),
    getCachedLookup("train_type"),
  ]);
```

Note lines 22-26 compute five summary tiles by filtering that full array
client-side:

```tsx
  const ac = trains.filter((t) => t.type === 0 && !t.isDisposed).length;
  const dc = trains.filter((t) => t.type === 1 && !t.isDisposed).length;
  const diesel = trains.filter((t) => t.type === 2 && !t.isDisposed).length;
  const disposed = trains.filter((t) => t.isDisposed).length;
```

Those counts need the whole set. Paginating the list without replacing them with
aggregate queries would silently make the tiles wrong — that is the trap on this
page.

**`src/app/(main)/users/page.tsx:40-47`**:

```tsx
  const people = await prisma.personnel.findMany({
    where: whereClause,
    orderBy: [{ hasAccount: "desc" }, { role: "asc" }, { firstName: "asc" }],
    include: { accessRole: true },
  });

  const accounts = people.filter((p) => p.hasAccount);
  const nonAccounts = people.filter((p) => !p.hasAccount);
```

**Plan 003 changes this query** to use `select: { ...PERSONNEL_SAFE_SELECT,
accessRole: true }` and adds a permission gate above it. If plan 003 has landed,
you will see that instead — it is expected, not drift, and **the `select` must
survive your changes**. The page also splits the result into two independently
rendered groups, which pagination has to account for.

**`src/app/(main)/phonebook/page.tsx:13-38`**:

```tsx
  const personnel = await prisma.personnel.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
```

mapped to an explicit field whitelist before being passed to `PhonebookClient`.
Note `PhonebookClient` does **not** use `DataTable` — it is a custom card/grid
UI (570 lines) with its own search. Paginating it is a different shape of job
from the other three.

**`src/app/(main)/dashboard/page.tsx:105-129`** — the ten-query loop:

```tsx
  // ۵. روند اجرای مانورها در ۱۰ روز گذشته
  const trendData: { date: string; count: number }[] = [];
  const now = new Date();

  for (let i = 9; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    const count = await prisma.manovr.count({
      where: {
        createdAt: { gte: d, lte: end },
        status: { not: 3 },
      },
    });

    const jalaliStr = d.toLocaleDateString("fa-IR", {
      calendar: "persian",
      month: "numeric",
      day: "numeric",
    });
    trendData.push({ date: jalaliStr, count });
  }
```

Ten sequential awaits. Note the day boundaries use the **server's local
timezone** (`setHours(0,0,0,0)`), while the label is rendered in the Persian
calendar. `CLAUDE.md` and `AGENTS.md` both require `Asia/Tehran` for all dates.
On a machine set to Tehran time these agree; elsewhere they do not. Preserve the
current bucketing behaviour exactly — see STOP conditions.

### The shared component — `src/components/DataTable.tsx`

Props today (lines 22-32):

```tsx
interface DataTableProps<T> {
  tableName: string;
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  initialHiddenColumns?: string[];
  getItemKey?: (item: T) => string | number;
  enableSelection?: boolean;
  bulkActions?: BulkAction<T>[];
}
```

The client-side pipeline (lines 97-133):

```tsx
  // فیلتر داده‌ها
  const filtered = data.filter((item) => {
    if (!search || searchFields.length === 0) return true;
    const term = search.toLowerCase();
    return searchFields.some((field) => {
      const val = item[field];
      if (val === undefined || val === null) return false;
      return String(val).toLowerCase().includes(term);
    });
  });

  // مرتب‌سازی
  const sorted = [...filtered].sort((a, b) => { /* ... */ });

  // صفحه‌بندی
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
```

`sorted` is also used by the selection logic at lines 156-160
(`selectAllFiltered` selects **every filtered row**, not just the visible page)
and by the row-count label at line 413. Both have to mean something different
in server mode — see Step 2.

### The five `DataTable` consumers

```bash
grep -rln "from \"@/components/DataTable\"" src/
```

- `src/app/(main)/manovrs/ManovrsTableClient.tsx` — **in scope**
- `src/app/(main)/trains/TrainsTableClient.tsx` — **in scope**
- `src/app/(main)/users/UsersTableClient.tsx` — **in scope**
- `src/app/(main)/lines/LinesTableClient.tsx` — **out of scope**, must keep working
- `src/app/(main)/admin/audit/AuditLogsClient.tsx` — **out of scope**, must keep working

That split is the central constraint of this plan: the new mode must be
**opt-in**, so the two out-of-scope clients continue in client-side mode with no
changes at all.

### Per-page filter state that lives above `DataTable`

`ManovrsTableClient` maintains eight filter fields of its own
(`src/app/(main)/manovrs/ManovrsTableClient.tsx:47-54`):

```tsx
  const [filterTrainCode, setFilterTrainCode] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [filterSourceLine, setFilterSourceLine] = React.useState("");
  const [filterDestLine, setFilterDestLine] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterConfirmation, setFilterConfirmation] = React.useState("");
  const [filterRahbar, setFilterRahbar] = React.useState("");
  const [filterCreator, setFilterCreator] = React.useState("");
```

These are applied to the array before it reaches `DataTable`. In server mode
they must become URL parameters, or the user filters only within the current
page. `UsersTableClient` has four similar filters (`:44-47`).

### Existing query-building infrastructure to reuse

`src/lib/report-engine.ts:33-137` (`buildPrismaWhere`) already turns a list of
`{ field, operator, value }` filters into a Prisma `where` object, with type
coercion per field and the soft-delete defaults at lines 129-134. Plan 001 adds
unit tests for it. **Reuse it** rather than writing a second filter translator —
but read it first: it is report-shaped (it defaults `status: { not: 3 }` for
manovrs) and that default may not match what a list page wants.

### `export const dynamic = "force-dynamic"`

All four pages declare it (`manovrs/page.tsx:9`, `trains/page.tsx:8`,
`users/page.tsx:9`, `phonebook/page.tsx:7`). Good — `searchParams` reads will
not be statically cached.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |
| Dev run   | `npm run dev`              | serves on :3000     |

## Scope

**In scope**:
- `src/lib/list-query.ts` (create — pagination param parsing and helpers)
- `src/components/DataTable.tsx` — add opt-in server mode
- `src/app/(main)/manovrs/page.tsx` and `ManovrsTableClient.tsx`
- `src/app/(main)/trains/page.tsx` and `TrainsTableClient.tsx`
- `src/app/(main)/users/page.tsx` and `UsersTableClient.tsx`
- `src/app/(main)/phonebook/page.tsx` and `PhonebookClient.tsx`
- `src/app/(main)/dashboard/page.tsx` — the trend loop only
- `src/lib/__tests__/list-query.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/app/(main)/lines/LinesTableClient.tsx` and
  `src/app/(main)/admin/audit/AuditLogsClient.tsx`. They must keep working
  **unmodified** — that is the proof the new mode is genuinely opt-in.
- `src/app/(main)/depot/DepotScene.tsx`. It loads all lines and trains by
  design; the 3D scene needs the full set. Its size is a separate known debt
  item.
- `src/lib/report-engine.ts` — reuse `buildPrismaWhere`, do not rewrite it. If
  it needs a change to be reusable, that is a STOP condition.
- The `select`/permission gate that plan 003 adds to `users/page.tsx`. Preserve
  it exactly.
- `src/app/actions/report.ts` row limits. The report builder returning unbounded
  rows is real but is a different surface with different UX.
- Adding database indexes. `prisma/schema.prisma` already indexes
  `Manovr.createdAt` (line 195), `Manovr.status` (194), `Manovr.type` (193),
  `Train.type` (136), `Train.isDisposed` (137), `Personnel.role` (49) and
  `.shift` (50). Do not add more without measuring.

## Git workflow

- Branch: `advisor/010-server-side-pagination`
- Commit per step — this plan has eight and a bisectable history is worth having
  here. Plain imperative subjects, e.g. `Add opt-in server mode to DataTable`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared list-query helpers

Create `src/lib/list-query.ts`. Pure functions only — no Prisma import, so it is
unit-testable.

```ts
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;

export interface ListParams {
  page: number;      // ۱-based
  pageSize: number;
  search: string;
  sortField: string | null;
  sortDir: "asc" | "desc";
}

/**
 * پارامترهای صفحه‌بندی را از searchParams می‌خواند و به مقادیر امن محدود می‌کند.
 * هر ورودی نامعتبر به مقدار پیش‌فرض برمی‌گردد — هیچ‌گاه throw نمی‌کند.
 */
export function parseListParams(
  raw: Record<string, string | string[] | undefined>,
  allowedSortFields: readonly string[]
): ListParams { /* ... */ }

/** تبدیل شماره صفحه به skip/take برای Prisma */
export function toPrismaPage(params: ListParams): { skip: number; take: number } { /* ... */ }

/** تعداد کل صفحات — همیشه حداقل ۱ */
export function totalPageCount(totalRows: number, pageSize: number): number { /* ... */ }
```

Required behaviour, all of which the tests in Step 8 assert:

- `page` below 1, non-numeric, or absent → `1`
- `pageSize` not in `PAGE_SIZE_OPTIONS` → `DEFAULT_PAGE_SIZE`; anything above
  `MAX_PAGE_SIZE` is clamped, never honoured
- `sortField` **must** be a member of `allowedSortFields`, otherwise `null`.
  This is not cosmetic: the value reaches Prisma's `orderBy` as an object key,
  and an unvalidated one from the URL is how a query builder gets abused
- `sortDir` accepts only `"asc"` / `"desc"`, defaulting to `"desc"`
- an array-valued param (Next gives `string[]` for repeated keys) takes the
  first element
- `totalPageCount(0, 20)` is `1`, not `0` — an empty list is still one page

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "prisma" src/lib/list-query.ts` → 0

### Step 2: Add opt-in server mode to `DataTable`

Extend `DataTableProps` with an optional block. When absent, behaviour is
**byte-for-byte** what it is today.

```tsx
export interface ServerPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  /** ناوبری صفحه — معمولاً router.push با searchParams به‌روزشده */
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** جستجو و مرتب‌سازی هم سمت سرور انجام می‌شود */
  search: string;
  onSearchChange: (value: string) => void;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  onSortChange: (col: string, dir: "asc" | "desc") => void;
}

interface DataTableProps<T> {
  // ...existing props unchanged...
  /** در صورت وجود، فیلتر/مرتب‌سازی/صفحه‌بندی سمت سرور انجام می‌شود */
  server?: ServerPagination;
}
```

Inside the component, branch once near the top of the render pipeline:

```tsx
  const isServerMode = server !== undefined;

  const filtered = isServerMode ? data : data.filter(/* ...existing... */);
  const sorted = isServerMode ? data : [...filtered].sort(/* ...existing... */);
  const paginated = isServerMode ? data : sorted.slice(/* ...existing... */);
  const totalRows = isServerMode ? server.totalRows : sorted.length;
  const totalPages = isServerMode
    ? Math.max(1, Math.ceil(server.totalRows / server.pageSize))
    : Math.ceil(sorted.length / pageSize);
```

In server mode, `data` is already the current page — do not filter, sort, or
slice it again.

Then route the four controls through the callbacks when in server mode: the
search input (line 173-180), the page-size `<select>` (187-197), the sortable
`<th>` handler (`handleSort`, line 88), and the prev/next buttons (416-432).

Three details that will bite:

1. **`selectAllFiltered` (lines 156-160) selects every row in `sorted`.** In
   server mode `sorted` is one page, so the button's label
   («انتخاب تمام {sorted.length} مورد», line 287) would claim to select the
   whole set while selecting one page. In server mode, either hide that button
   or relabel it to name the page. Do **not** silently leave it lying.
2. **The `useEffect` at lines 131-133 resets `currentPage` to 1** when search or
   sort changes. In server mode the page lives in the URL, so this local reset
   must not fire — guard it with `isServerMode`.
3. **The row-count label at line 413** reads `sorted.length`. Use `totalRows`.

Add `PAGE_SIZE_OPTIONS` from `src/lib/list-query.ts` to the page-size select so
client and server modes offer the same choices. Today it hardcodes 5/10/20/50
(lines 193-196).

**Verify**:
- `npx tsc --noEmit` → exit 0
- Run the app and open `/lines` and `/admin/audit`. Both must behave exactly as
  before — search, sort, and paging all client-side. This is the regression
  check for the whole plan; do not proceed until it passes.

### Step 3: Paginate `/manovrs`

The highest-value page — do it first and get it right before repeating.

**Server (`src/app/(main)/manovrs/page.tsx`)**: accept `searchParams`, parse
with `parseListParams`, and issue two queries in the existing `Promise.all`:
`prisma.manovr.findMany({ where, orderBy, skip, take, include })` and
`prisma.manovr.count({ where })`.

Allowed sort fields: `id`, `createdAt`, `executionTime`, `finishedAt`, `type`,
`status`, `confirmationStatus`. Relation sorts (`train.code`, `sourceLine.name`)
follow the shape already in `src/lib/report-engine.ts:147-162` — reuse that
mapping if you support them; otherwise leave them out of the allowlist and say
so.

Build `where` from the URL filter params. Reuse `buildPrismaWhere` from
`src/lib/report-engine.ts` if the filter shapes line up. **Check its soft-delete
default first**: line 129 forces `status: { not: 3 }` for manovrs. The current
`/manovrs` page has no such filter — it shows deleted manovrs. Applying
`buildPrismaWhere` blindly would silently hide rows. If the defaults do not
match, build the `where` inline on the page and say so in your report.

**Client (`ManovrsTableClient.tsx`)**: the eight filter fields at lines 47-54
become URL params. Use `useRouter` + `useSearchParams` and push updated query
strings; the page is `force-dynamic`, so each push re-runs the server component.
Debounce the free-text inputs (`filterTrainCode`, `filterRahbar`,
`filterCreator`) — roughly 300ms — or every keystroke becomes a round trip.

Keep `useLiveRefresh(["manovr_changed"])` at line 45 exactly as it is. Plan 005
fixes its reconnect behaviour; do not touch it here.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `/manovrs` loads, shows one page, and the pager navigates
- Filters narrow the **whole** result set, not just the visible page — set a
  filter that matches a row on page 3 and confirm it appears on page 1
- The URL carries the state, and a reload restores it

### Step 4: Paginate `/trains` — and fix the tiles first

**Replace the five summary tiles with aggregate queries before paginating.**
Lines 22-26 filter the full array; once `trains` is one page they become wrong.
Use `prisma.train.count` with the matching `where` for each tile, or a single
`groupBy({ by: ["type"], where: { isDisposed: false } })` plus one count for
disposed. Do this in the same `Promise.all`.

Then apply the Step 3 pattern: `searchParams` → `parseListParams` →
`findMany` + `count`, and move `TrainsTableClient`'s filters to URL params.

Allowed sort fields: `code`, `type`, `status`, `slotIndex`, `isDisposed`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- The five tiles show the same numbers as before your change — record the
  before/after values in your report
- Pagination and filtering work as in Step 3

### Step 5: Paginate `/users`

The complication: lines 46-47 split the result into `accounts` and
`nonAccounts`, rendered as two groups. Paginating a single query then splitting
gives ragged group sizes.

Two workable approaches — pick one and record which:

- **(a)** Keep the existing `orderBy: [{ hasAccount: "desc" }, ...]`, paginate
  the combined set, and split whatever the current page contains. Simple;
  groups vary per page.
- **(b)** Paginate only the `accounts` group (the one that grows) and keep
  `nonAccounts` unpaginated with its own count. More code; better UX if account
  holders vastly outnumber non-account personnel.

Prefer (a) unless the data says otherwise.

**Preserve, exactly**: the shift-supervisor `whereClause` at lines 33-38, the
`todayManeuvers` block at lines 50-89 (already scoped by date and subordinate
ids — leave it), and, if plan 003 has landed, the permission gate and the
`PERSONNEL_SAFE_SELECT` field list.

Allowed sort fields: `firstName`, `lastName`, `role`, `shift`, `orgPosition`,
`personnelCode`, `hasAccount`, `createdAt`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "PERSONNEL_SAFE_SELECT" "src/app/(main)/users/page.tsx"` → still
  present if plan 003 landed
- A shift-supervisor account still sees only its own shift's personnel
- Pagination and filtering work

### Step 6: Paginate `/phonebook`

`PhonebookClient` does not use `DataTable` — it is a 570-line custom card grid
with its own search. Do **not** retrofit it onto `DataTable`; that is a rewrite,
not a pagination change.

Instead: move its search term to a URL param, add `skip`/`take` and a `count` on
the server, and add a simple pager to the client. Keep the existing field
whitelist at lines 24-36 exactly as it is — it is the pattern plan 003 cites as
the correct example.

Allowed sort fields: `lastName`, `firstName`, `personnelCode`, `shift`,
`orgPosition`.

**Verify**:
- `npx tsc --noEmit` → exit 0
- Search matches across the whole directory, not just the loaded page
- `grep -n "passwordHash" "src/app/(main)/phonebook/page.tsx"` → no matches

### Step 7: Collapse the dashboard trend loop

In `src/app/(main)/dashboard/page.tsx`, replace lines 105-129 with **one**
query over the ten-day range, bucketed in JavaScript:

```tsx
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 9);
  rangeStart.setHours(0, 0, 0, 0);

  const trendRows = await prisma.manovr.findMany({
    where: { createdAt: { gte: rangeStart }, status: { not: 3 } },
    select: { createdAt: true },
  });
```

then bucket by day and build the same `{ date, count }[]`, keeping every day in
the window — including zero-count days, which the current loop produces and a
naive `groupBy` would drop.

**Preserve the current bucketing semantics exactly.** The existing code uses
`setHours(0,0,0,0)` — server local time — while labelling with
`toLocaleDateString("fa-IR", { calendar: "persian", ... })`. That is arguably
wrong per `CLAUDE.md`'s `Asia/Tehran` rule, but **fixing it is not this plan's
job**: it would shift every bucket boundary and change reported numbers.
Reproduce the current behaviour and note the discrepancy in your report.

A `groupBy` on `createdAt` is not usable here: it groups by exact timestamp, not
by day. `findMany` + in-memory bucketing is the right call at ten days of data.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "for (let i = 9" "src/app/(main)/dashboard/page.tsx"` → no matches
- The chart shows the same ten labels and the same counts as before — record
  before/after values

### Step 8: Write the tests

Create `src/lib/__tests__/list-query.test.ts`.

`parseListParams` — required cases:
- `{}` → page 1, `DEFAULT_PAGE_SIZE`, empty search, null sort, `"desc"`
- `{ page: "0" }`, `{ page: "-3" }`, `{ page: "abc" }` → page 1
- `{ pageSize: "999" }` → clamped to `MAX_PAGE_SIZE`
- `{ pageSize: "7" }` (not an option) → `DEFAULT_PAGE_SIZE`
- `{ sort: "createdAt" }` with `createdAt` allowed → `"createdAt"`
- `{ sort: "passwordHash" }` with it **not** allowed → `null` (the important one)
- `{ dir: "sideways" }` → `"desc"`
- `{ page: ["2", "5"] }` → page 2 (first element wins)

`toPrismaPage`:
- page 1, size 20 → `{ skip: 0, take: 20 }`
- page 3, size 20 → `{ skip: 40, take: 20 }`

`totalPageCount`:
- `(0, 20)` → 1
- `(20, 20)` → 1
- `(21, 20)` → 2

**Verify**: `npm run test:run` → exit 0.

### Step 9: Confirm the full gate and the out-of-scope pages

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

Then, in a running dev server, walk **all five** `DataTable` pages: `/manovrs`,
`/trains`, `/users` (paginated) and `/lines`, `/admin/audit` (unchanged).

**Verify**: all four commands exit 0; the two out-of-scope pages behave exactly
as before and appear nowhere in `git diff --name-only`.

## Test plan

- New file: `src/lib/__tests__/list-query.test.ts` — roughly 15 cases per
  Step 8. The `sortField` allowlist cases are the ones that matter most.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, English test
  names.
- **`DataTable`'s server mode is not unit-tested.** It is a React component and
  plan 001 configured Vitest with `environment: "node"` and no testing-library.
  Adding that infrastructure is a plan of its own. Server mode is verified by
  the per-step runtime checks and by the out-of-scope-page regression check in
  Step 2 and Step 9. State this plainly in your report.
- Record the before/after numbers for the `/trains` tiles (Step 4) and the
  dashboard trend (Step 7). Those are the two places where a correct-looking
  refactor silently changes displayed values.
- Verification: `npm run test:run` → exit 0.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f src/lib/list-query.ts` succeeds; `grep -c "prisma" src/lib/list-query.ts` returns 0
- [ ] `grep -c "prisma.manovr.count\|prisma.train.count\|prisma.personnel.count" "src/app/(main)/manovrs/page.tsx" "src/app/(main)/trains/page.tsx" "src/app/(main)/users/page.tsx" "src/app/(main)/phonebook/page.tsx"` returns a match in each
- [ ] `grep -n "take:" "src/app/(main)/manovrs/page.tsx"` returns a match
- [ ] `grep -n "for (let i = 9" "src/app/(main)/dashboard/page.tsx"` returns no matches
- [ ] `git diff --name-only` lists **neither** `LinesTableClient.tsx` **nor**
      `AuditLogsClient.tsx`
- [ ] `grep -n "PERSONNEL_SAFE_SELECT" "src/app/(main)/users/page.tsx"` returns a
      match, if plan 003 has landed
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including all `list-query` cases
- [ ] `npm run build` exits 0
- [ ] `/lines` and `/admin/audit` verified working unchanged
- [ ] `/trains` tile before/after values recorded and identical
- [ ] Dashboard trend before/after values recorded and identical
- [ ] `plans/README.md` status row for 010 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file —
  **except** `users/page.tsx`, which plan 003 legitimately changes.
- After Step 2, `/lines` or `/admin/audit` behaves differently in any way. The
  server mode is not opt-in enough; fix that before touching any page.
- Making `buildPrismaWhere` reusable requires modifying
  `src/lib/report-engine.ts`. Build the `where` inline on the page instead and
  report why.
- The `/trains` tile numbers change. That means the aggregate queries in Step 4
  do not reproduce the array filters; report both sets of numbers.
- The dashboard trend numbers change. Report the old and new arrays. Do not
  "fix" the timezone while you are there — see Step 7.
- Paginating `/users` conflicts with the shift-supervisor `whereClause` or the
  `todayManeuvers` query. Report the interaction.
- You conclude `PhonebookClient` needs restructuring onto `DataTable` to be
  paginated. That is a rewrite; report instead.
- The plan starts requiring changes to a sixth `DataTable` consumer, or to
  `DepotScene.tsx`.
- You are tempted to add database indexes. Measure first, and make it a separate
  plan.

## Maintenance notes

- **`DataTable`'s server mode is opt-in and must stay that way.** Two consumers
  still rely on client-side mode. Anyone "simplifying" by making server mode the
  default breaks `/lines` and `/admin/audit` — silently, because those pages
  would then render one unpaginated page and claim it is everything. That is the
  single most important thing for a reviewer to check.
- The `sortField` allowlist in `parseListParams` is a security boundary, not
  ergonomics: the value becomes a Prisma `orderBy` key. Every new sortable
  column must be added to the page's allowlist explicitly.
- **The dashboard trend's day bucketing uses server local time while labelling
  in the Persian calendar** (`src/app/(main)/dashboard/page.tsx`). This plan
  deliberately preserves that so the numbers do not move. It contradicts the
  `Asia/Tehran` rule in `CLAUDE.md` and `AGENTS.md` and should be fixed
  deliberately, with the change in reported figures understood and accepted.
- `/manovrs` shows soft-deleted manovrs (`status: 3`) today because it applies
  no status filter, unlike `buildPrismaWhere`'s report default. If a future
  change routes the list through the report engine, that behaviour flips
  silently.
- Deferred out of this plan: row limits on `runDynamicReport`
  (`src/app/actions/report.ts:18`), which still returns unbounded result sets to
  the report builder. Different surface, different UX question.
