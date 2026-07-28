# Plan 012: Stop the build from copying the project into itself, and clear out dead files

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
> **This plan deletes files.** Every deletion is listed explicitly with the
> evidence that it is unreferenced. Delete nothing that is not on the list, and
> re-run the evidence command yourself before each deletion.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

`next build` with `output: "standalone"` produces a `.next/standalone/`
directory that is supposed to contain a minimal server plus its traced
dependencies. On this repository it is **728 MB**, and it contains a copy of
the entire project — including the application source, the `.env` file, the
`backups/` folder, the seed data, and the three previous installer artifacts
sitting in the repository root.

Two consequences follow, one security and one operational:

- `package.json` packages `.next/standalone/**/*` wholesale into the Electron
  installer. Plan 002 fixes the `.env` half of that specifically; this plan
  fixes the underlying cause, which is that the standalone output should never
  have contained any of it.
- Each build embeds the previous build's installers, so artifacts compound
  across builds. 409 MB of the 728 MB is three files that are themselves build
  output.

The secondary items are ordinary housekeeping that would not justify a plan on
their own but are worth doing while the build config is open: a dead demo
component, a stray prompt file left in the root, and a README that is still
unmodified `create-next-app` boilerplate — which means the one document a new
operator reads describes a project that does not exist.

## Current state

### The measured problem

```
$ du -sh .next/standalone
728M

$ du -sh .next/standalone/{node_modules,.next,src,prisma,public,backups,seed}
300M    node_modules      ← legitimate: the traced dependency subset
12M     .next             ← legitimate: the compiled server
1.2M    src               ← should not be here
1.0M    prisma            ← should not be here
1.1M    public            ← legitimate (served assets)
3.9M    backups           ← should not be here
96K     seed              ← should not be here

$ du -sh ".next/standalone/ManovrSystem 0.1.0.exe" \
         ".next/standalone/ManovrSystem Setup 0.1.0.exe" \
         ".next/standalone/ManovrSystem 0.1.0.rar"
150M    ManovrSystem 0.1.0.exe
150M    ManovrSystem Setup 0.1.0.exe
109M    ManovrSystem 0.1.0.rar
```

`.next/standalone/.env` also exists (1.0K).

### `next.config.ts` in full — no tracing exclusions

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

This is the file to change. Next's file tracer walks from the project root; with
no `outputFileTracingExcludes`, unrelated root-level files end up in the copy.

### How the artifacts get into the root — `scripts/build.js:105-118`

```js
    console.log('7. Copying final packages to root directory...');
    // Stop any running processes to prevent file locks
    try {
      execSync('taskkill /f /im ManovrSystem.exe', { stdio: 'ignore' });
    } catch (e) {}

    fs.readdirSync(distDir).forEach(file => {
      if (file.endsWith('.exe')) {
        const src = path.join(distDir, file);
        const dest = path.join(rootDir, file);
        fs.copyFileSync(src, dest);
        console.log(`Copied package to root: ${file}`);
      }
    });
```

Step 7 copies the finished installers into the repository root. The next build's
step 1 cleans them up again (`scripts/build.js:70-79`):

```js
    fs.readdirSync(rootDir).forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (['.exe', '.zip', '.rar'].includes(ext) || file.startsWith('query_engine-windows.dll.node.tmp')) {
        try {
          fs.unlinkSync(path.join(rootDir, file));
          console.log(`Deleted root file: ${file}`);
        } catch (e) {}
      }
    });
```

So `npm run build:electron` is self-cleaning. **`npm run build` on its own is
not** — and that is the path that produced the 728 MB directory currently on
disk. Anyone who runs a bare `npm run build` while artifacts sit in the root, then
packages, ships all of it. The tracing exclusions in Step 1 close that door
regardless of which command was used.

### `package.json:84-89` — what gets packaged

```json
    "files": [
      "main.js",
      ".next/standalone/**/*",
      "public/**/*",
      "!node_modules/**/*"
    ]
```

> If plan 002 has landed, there will be a fourth entry,
> `"!.next/standalone/**/.env*"`. That is expected, not drift. **Keep it.** This
> plan makes it redundant rather than replacing it — belt and braces on a
> credential is proportionate.

### Dead file 1 — `src/components/ui/demo.tsx`

87 lines. Imports `BorderRotate` and Phosphor icons, exports three showcase
components (`Default`, `FastAnimation`, `StopOnHover`).

Evidence it is unreferenced:

```bash
grep -rn "ui/demo\|from \"./demo\"" src/ | grep -v "components/ui/demo.tsx"
```

Expected: no matches.

**`src/components/ui/animated-gradient-border.tsx` stays.** `BorderRotate` is
used ~18 times in `src/app/(main)/depot/DepotScene.tsx` (lines 756, 788, 813,
845, 870, 988, 1015, 1040, 1074, 1603, 1628, 1665, 1688, 1705, 1726, 1743,
1763, 1785) and its CSS lives at `src/app/globals.css:1151`. Only the demo file
goes.

### Dead file 2 — `boo.md`

A 7 KB file in the repository root containing a component-integration prompt
from a UI component marketplace: instructions to copy an
`animated-gradient-border.tsx` into `components/ui`, plus demo code and setup
steps.

It is a leftover working note, not project documentation. It is also
**instructional text addressed to a coding agent** sitting in the repository
root, which is exactly the shape of thing that should not be left lying around
in a codebase agents operate on.

The component it describes was already integrated (and adapted to Phosphor
icons rather than the `lucide-react` the file specifies). The file has served
its purpose.

Evidence it is unreferenced:

```bash
grep -rn "boo.md" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=plans
```

Expected: no matches.

### Stale doc — `README.md`

Unmodified `create-next-app` boilerplate. It documents `npm run dev` and links
to the Next.js tutorial and Vercel deployment. It says nothing about Prisma,
`npx prisma db push`, `node prisma/seed-v3.mjs`, the required `AUTH_SECRET`, the
Electron build (`npm run build:electron`), or the fact that this is an offline
desktop application rather than a web deployment.

`CLAUDE.md` and `AGENTS.md` both carry accurate project instructions — in
Persian, aimed at agents. The README is the only English/operator-facing entry
point and it is wrong.

> If plan 002 has landed, `README.md` already has an `AUTH_SECRET` setup note
> and a `## Security note` section. **Preserve both** — fold them into the
> rewrite rather than overwriting them.

### The commands the README must document, verified from `package.json:6-12`

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "build:electron": "node scripts/build.js"
  },
```

plus, from `CLAUDE.md`, `npx prisma db push` and `node prisma/seed-v3.mjs`. If
plan 001 has landed there will also be `test` and `test:run`.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0 (if plan 001 landed) |
| Build     | `npm run build`            | exit 0              |
| Measure   | `du -sh .next/standalone`  | see Step 2          |

## Scope

**In scope**:
- `next.config.ts` — add tracing exclusions
- `README.md` — rewrite
- `src/components/ui/demo.tsx` — delete
- `boo.md` — delete

**Out of scope** (do NOT touch, even though they look related):
- `src/components/ui/animated-gradient-border.tsx`. Heavily used.
- `scripts/build.js`. Its copy-to-root step is the *source* of the artifacts,
  but changing where a build drops its output changes an operator's workflow —
  the tracing exclusion solves the problem without that. See Maintenance notes.
- `package.json`'s `build.files` array. Plan 002 owns it. If plan 002's `.env`
  negation is there, leave it.
- `CLAUDE.md` and `AGENTS.md`. Accurate and agent-facing; the README is the gap.
- The three installer artifacts in the repository root
  (`ManovrSystem 0.1.0.exe`, `ManovrSystem Setup 0.1.0.exe`,
  `ManovrSystem 0.1.0.rar`). They are untracked build output and the operator's
  to manage. **Do not delete them** — `scripts/build.js:70-79` already removes
  them on the next `build:electron`, and 409 MB of someone else's artifacts is
  not yours to discard. Adding them to `.gitignore` is the right move; deleting
  them is not.
- `backups/` (3.9 MB). Real backup output from `src/lib/backup.ts:11`. Excluded
  from the build, not deleted.
- Running `npm run build:electron`. It takes many minutes and writes hundreds of
  megabytes to `D:/manovr-build-dist`. Step 2 verifies with `npm run build`
  alone, which is enough to measure the standalone output.

## Git workflow

- Branch: `advisor/012-trim-package-and-dead-files`
- Separate commits for the build fix and the housekeeping — they are unrelated
  and a reviewer should be able to look at them apart.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Exclude the project's own files from the traced output

Rewrite `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // خروجی standalone نباید شامل سورس، فایل‌های محیطی، پشتیبان‌ها و
  // خروجی بیلدهای قبلی باشد. بدون این محدودیت‌ها، فایل‌تریسر کل پوشه‌ی پروژه
  // را کپی می‌کند و نصب‌کننده‌ی الکترون همه‌ی آن را بسته‌بندی می‌کند.
  outputFileTracingExcludes: {
    "*": [
      "**/*.exe",
      "**/*.rar",
      "**/*.zip",
      ".env*",
      "backups/**",
      "seed/**",
      "src/**",
      "scripts/**",
      "plans/**",
      ".agents/**",
      ".claude/**",
      "**/*.tsbuildinfo",
    ],
  },
};

export default nextConfig;
```

Three things to be careful about:

- **`prisma/**` is deliberately NOT excluded.** `package.json:78-83` copies
  `prisma/dev.db` into the installer via `extraResources`, and `main.js:41-43`
  reads it as the template database on first run. Excluding `prisma/` could
  break first-run database seeding. Leave it.
- **`public/**` is NOT excluded.** The standalone server serves those assets,
  and `src/lib/export-helpers.ts:176-177` reads the Vazirmatn font files from
  `public/fonts/` at PDF-generation time using `process.cwd()`. Excluding it
  would break Persian PDF export at runtime — a failure that would not show up
  until someone exported a report.
- **`src/**` is safe to exclude** because the standalone server runs compiled
  output from `.next/`, not TypeScript source. Step 2 verifies this rather than
  assuming it.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "outputFileTracingExcludes" next.config.ts` → present
- `grep -c "prisma/\*\*\|public/\*\*" next.config.ts` → 0 (neither excluded)

### Step 2: Measure the result and confirm the server still runs

```bash
rm -rf .next
npm run build
du -sh .next/standalone
```

**Verify**:
- `npm run build` exits 0
- `du -sh .next/standalone` reports substantially less than 728 MB. Expect
  roughly 315 MB — the 300 MB traced `node_modules` plus the 12 MB compiled
  server plus `public/`. Record the actual figure.
- `test -f .next/standalone/.env` → **fails** (the file is gone)
- `ls .next/standalone/*.exe .next/standalone/*.rar 2>/dev/null` → nothing
- `test -d .next/standalone/src` → **fails**
- `test -d .next/standalone/backups` → **fails**
- `test -d .next/standalone/public` → **succeeds** (still there — needed for
  fonts and static assets)

Then confirm the trimmed server actually works — this is the load-bearing check,
because an over-aggressive exclusion produces a build that succeeds and a server
that fails at runtime:

```bash
node .next/standalone/server.js
```

with `AUTH_SECRET` and `DATABASE_URL` set in the environment (mirroring what
`main.js:82-88` passes). Open `http://localhost:3000`, log in, and:

1. load `/depot` — the main view renders
2. export a report to **PDF** — this is the `public/fonts/` dependency; if the
   font exclusion was wrong, this is where it shows

**Verify**: both work. Stop the server afterwards.

If the standalone server fails to start or the PDF export breaks, the exclusion
list is too aggressive — see STOP conditions.

### Step 3: Delete the dead demo component

Re-run the evidence command yourself:

```bash
grep -rn "ui/demo\|from \"./demo\"" src/ | grep -v "components/ui/demo.tsx"
```

**Only if it returns nothing**, delete the file:

```bash
git rm src/components/ui/demo.tsx 2>/dev/null || rm src/components/ui/demo.tsx
```

(The file is untracked in this repo, so plain `rm` is what will apply.)

**Verify**:
- `test -f src/components/ui/demo.tsx` → fails
- `test -f src/components/ui/animated-gradient-border.tsx` → **succeeds**
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0

### Step 4: Delete the stray prompt file

Re-run the evidence command:

```bash
grep -rn "boo.md" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=plans
```

**Only if it returns nothing**, delete `boo.md`.

**Verify**: `test -f boo.md` → fails

### Step 5: Add build artifacts to `.gitignore`

The three installers in the root are untracked, so nothing is at risk today —
but `.gitignore` should say so explicitly, since a 150 MB accidental `git add`
is unpleasant to undo.

Append to `.gitignore`:

```
# electron build artifacts
*.exe
*.rar
*.zip
```

Do not delete the existing artifacts.

**Verify**:
- `git check-ignore -q "ManovrSystem 0.1.0.exe"; echo $?` → `0` (ignored)
- `git status --porcelain` → does not list any `.exe` or `.rar`

### Step 6: Rewrite the README

Replace `README.md` with documentation of the project as it actually is. It
should cover, in this order:

1. **What this is** — a terminal maneuver management system for Fath-Abad
   depot, distributed as an offline Windows desktop application (Electron +
   Next.js standalone server + SQLite), not a web deployment.
2. **Prerequisites** — Node.js, npm, Windows for the Electron build.
3. **First-time setup** — `npm install`, create `.env` from `.env.example`
   (generate `AUTH_SECRET`, set `DATABASE_URL`), `npx prisma db push`,
   `node prisma/seed-v3.mjs`.
4. **Development** — `npm run dev`, on `http://localhost:3000`.
5. **Verification** — `npx tsc --noEmit`, `npm run lint`, and `npm run test:run`
   if plan 001 has landed.
6. **Building the desktop app** — `npm run build:electron`; output goes to
   `D:/manovr-build-dist` and installers are copied to the repository root;
   the packaged app keeps its database in the user's `AppData` folder.
7. **Project conventions** — one short paragraph pointing at `CLAUDE.md` and
   `AGENTS.md` for the RTL/Persian, `hasPerm`, and Jalali/`Asia/Tehran` rules
   rather than restating them.
8. **Security note** — preserved from plan 002 if present.

Keep it under roughly 100 lines. Verify every command you document by running
it, or mark it explicitly as untested — a README that is confidently wrong is
worse than the boilerplate it replaced.

**Verify**:
- `grep -c "create-next-app" README.md` → 0
- `grep -c "AUTH_SECRET" README.md` → at least 1
- `grep -c "prisma db push" README.md` → at least 1
- `grep -c "build:electron" README.md` → at least 1
- If plan 002 landed: `grep -c "Security note" README.md` → at least 1

### Step 7: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run build
```

plus `npm run test:run` if plan 001 has landed.

**Verify**: all exit 0.

## Test plan

- **No new tests.** This plan changes build configuration and documentation and
  deletes two unreferenced files. There is no new logic to cover, and a test
  asserting on build output size would be brittle and low-value.
- The existing suite (from plans 001–011) is the regression net where it exists:
  `npm run test:run` must pass unchanged.
- The real verification is Step 2's runtime check of the trimmed standalone
  server — particularly the PDF export, which exercises the `public/fonts/`
  dependency that an over-broad exclusion would silently break.
- Record the before (728 MB) and after standalone sizes in your report.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "outputFileTracingExcludes" next.config.ts` returns a match
- [ ] `du -sh .next/standalone` reports substantially less than 728 MB (record it)
- [ ] `test -f .next/standalone/.env` fails
- [ ] `ls .next/standalone/*.exe .next/standalone/*.rar 2>/dev/null` prints nothing
- [ ] `test -d .next/standalone/src` fails
- [ ] `test -d .next/standalone/public` **succeeds**
- [ ] Step 2's standalone server ran, `/depot` loaded, and PDF export worked
- [ ] `test -f src/components/ui/demo.tsx` fails
- [ ] `test -f src/components/ui/animated-gradient-border.tsx` succeeds
- [ ] `test -f boo.md` fails
- [ ] `git check-ignore -q "ManovrSystem 0.1.0.exe"` exits 0
- [ ] The three root installer artifacts still exist (not deleted)
- [ ] `grep -c "create-next-app" README.md` returns 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 012 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file —
  except `package.json`'s `build.files` and `README.md`, which plan 002
  legitimately changes.
- Either evidence `grep` in Step 3 or Step 4 returns a match. Do not delete a
  referenced file; report what references it.
- `npm run build` fails after adding `outputFileTracingExcludes`. Remove the
  exclusions one at a time to identify which is responsible, and report — do not
  keep a build broken to chase a size number.
- The standalone server in Step 2 fails to start, or `/depot` or PDF export
  breaks. The exclusion list is too aggressive. The likely culprits are
  `public/**` (fonts, at `src/lib/export-helpers.ts:176-177`) and `prisma/**`
  (the template database, at `main.js:41-43`) — neither of which this plan
  excludes, so a failure means something else is being traced from a location
  the list catches. Report the error.
- The standalone size does not drop meaningfully. That would mean
  `outputFileTracingExcludes` is not doing what this plan assumes; report the
  actual figures and the directory breakdown rather than trying more patterns.
- You find yourself editing `scripts/build.js`, `package.json`, or
  `src/components/ui/animated-gradient-border.tsx`.
- You are tempted to delete the three root installer artifacts, or `backups/`.
  Neither is yours to remove.

## Maintenance notes

- **The exclusion list in `next.config.ts` is a denylist, so it needs upkeep.**
  A new root-level directory of build output or working files will end up in the
  standalone copy — and therefore in the installer — unless it is added. If the
  list grows past a handful more entries, inverting the approach (setting
  `outputFileTracingRoot` to a narrower directory) is the better long-term
  answer, and is a design change worth its own plan.
- `prisma/**` and `public/**` are **deliberately not excluded**. `main.js:41-43`
  reads `prisma/dev.db` as the first-run template, and
  `src/lib/export-helpers.ts:176-177` resolves the Persian PDF fonts from
  `public/fonts/` via `process.cwd()` at runtime. Excluding either produces a
  build that passes and an application that fails later — the PDF one only when
  someone exports a report. That is the trap for a future reviewer.
- `scripts/build.js:105-118` still copies finished installers into the
  repository root, and `scripts/build.js:70-79` still deletes them at the start
  of the next `build:electron`. That loop is self-consistent, but it means a
  bare `npm run build` between the two is what created the 728 MB directory in
  the first place. The tracing exclusions make that harmless; changing where the
  build drops its output would be cleaner but changes an operator workflow, so
  it was left alone deliberately.
- Plan 002 adds `"!.next/standalone/**/.env*"` to `package.json`'s `build.files`.
  After this plan that entry is redundant — the file is no longer in the
  standalone output at all. **Keep it anyway.** Two independent guards on a
  signing key is proportionate, and the packaging one survives a future change
  to the tracing config.
- The README now documents commands. Whoever changes a script name in
  `package.json` should update it in the same commit; a confidently wrong README
  is worse than no README.
