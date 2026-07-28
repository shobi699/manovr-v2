# Plan 002: Require a real JWT signing secret and stop shipping it inside the installer

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
> **Handling rule for this plan**: `.env` contains a live credential. Do not
> print its contents, do not copy any value from it into code, comments, commit
> messages, test fixtures, or your report. Refer to it as "the `AUTH_SECRET`
> value in `.env`". If you need to confirm a variable is set, test for
> presence (`-n "$VAR"`), never echo it.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md
- **Category**: security
- **Planned at**: commit `3ec213d`, 2026-07-29

## Why this matters

Every session in this system is a JWT signed with HS256. Whoever holds the
signing key can mint a `manovr_session` cookie for any user id with any role,
including `role: 4` (super admin) — which grants database download, database
restore, and source-code backup download via `src/app/api/admin/backups/route.ts`
and `src/app/actions/backup.ts`.

Two independent problems put that key in reach:

1. `src/lib/auth.ts:4-6` falls back to a hardcoded literal when `AUTH_SECRET`
   is unset. The literal is in the source. Any deployment missing the env var
   silently signs every session with a value anyone can read.
2. The packaged Electron app ships the `.env` file. `next build` copies it into
   `.next/standalone/`, and `package.json` packages `.next/standalone/**/*`
   wholesale into the installer. Anyone with a copy of the installed
   application can extract the signing key from their own machine.

`src/lib/backup.ts` compounds this by adding `.env` to a downloadable
source-code backup zip.

After this plan, the server refuses to start without a real secret, each
installation generates its own, and the key is not present in any distributed
artifact.

**The existing `AUTH_SECRET` value is burned regardless of what this plan
does.** It has been in a shipped installer. Removal is not rotation. Rotation
is called out explicitly in Step 6.

## Current state

### `src/lib/auth.ts:1-29` — the fallback and the cookie

```ts
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret"
);
const COOKIE = "manovr_session";

export interface Session {
  id: number;
  userName: string;
  fullName: string;
  role: number;
  perms?: string[]; // مجوزهای نقش سفارشی (از v3)
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
```

Sessions last 12 hours (`setExpirationTime("12h")` and `maxAge: 60 * 60 * 12`).
Changing the secret invalidates every outstanding session immediately.

### `main.js:71-101` — the fork that never passes `AUTH_SECRET`

```js
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js')
    : path.join(__dirname, '.next', 'standalone', 'server.js');
  writeLog(`Looking for standalone server at: ${serverPath}`);

  if (!fs.existsSync(serverPath)) {
    writeLog(`ERROR: Next.js standalone server not found at: ${serverPath}`);
    return;
  }

  // فورک کردن پروسه سرور Next.js با استفاده از انجین Node داخلی الکترون
  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: `file:${dbPath}`,
      NODE_ENV: 'production'
    },
    cwd: app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone')
      : path.join(__dirname, '.next', 'standalone'),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
```

`AUTH_SECRET` is absent from that env block. The packaged app only works today
because Next loads the `.env` that got copied into the standalone directory.

### `main.js:10-14` — the existing userData paths to model after

```js
const userDataPath = app.getPath('userData');
const dbFolder = path.join(userDataPath, 'database');
const dbPath = path.join(dbFolder, 'dev.db');
```

`setupDatabase()` at `main.js:31-53` is the exemplar for "create it on first
run if absent" — follow its shape.

### `package.json:84-89` — what electron-builder packages

```json
    "files": [
      "main.js",
      ".next/standalone/**/*",
      "public/**/*",
      "!node_modules/**/*"
    ]
```

Confirmed present today: `.next/standalone/.env` exists on disk. That glob
includes it.

### `src/lib/backup.ts:82-89` — `.env` in the source-code backup zip

```ts
  // فایل‌های پیکربندی کلیدی پروژه
  const configFiles = ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", ".env"];
  configFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      zip.addLocalFile(filePath);
    }
  });
```

That zip is downloadable through `src/app/api/admin/backups/route.ts:24-28`.

### `.gitignore:33-34` — `.env` is correctly untracked

```
# env files (can opt-in for committing if needed)
.env*
```

Confirmed: `git ls-files | grep -E "\.env"` returns nothing. The problem is the
build artifact and the backup zip, not git.

## Commands you will need

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Install   | `npm install`              | exit 0              |
| Typecheck | `npx tsc --noEmit`         | exit 0              |
| Lint      | `npm run lint`             | exit 0              |
| Tests     | `npm run test:run`         | exit 0, all pass    |
| Build     | `npm run build`            | exit 0              |

## Scope

**In scope** (the only files you should modify or create):
- `src/lib/auth.ts`
- `main.js`
- `src/lib/backup.ts`
- `package.json` (the `build.files` array only)
- `.env.example` (create)
- `README.md` (add the `AUTH_SECRET` setup requirement — a few lines only)
- `src/lib/__tests__/auth-secret.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `.env` itself. Do not edit it, do not read its values into anything, do not
  delete it. Rotating the value is an operator action described in Step 6.
- `src/app/api/admin/backups/route.ts` — its role checks are addressed by other
  plans; this plan only removes `.env` from what the zip contains.
- The `Session` interface and anything that consumes it. Do not change the
  token payload, the cookie name, the 12h expiry, or the cookie flags.
- `scripts/build.js` — the electron build driver. If the packaging change
  requires touching it, that is a STOP condition.

## Git workflow

- Branch: `advisor/002-jwt-signing-secret`
- Plain imperative commit subjects, e.g. `Fail fast when AUTH_SECRET is unset`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make a missing `AUTH_SECRET` a hard failure

In `src/lib/auth.ts`, replace the module-scope secret construction at lines
4-6 with a version that throws when the variable is absent or obviously too
weak to be a real key. Target shape:

```ts
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  throw new Error(
    "AUTH_SECRET is not set, or is shorter than 32 characters. " +
      "Session tokens cannot be signed safely without it. " +
      "Set AUTH_SECRET to a random 32+ character value before starting the server. " +
      "See README.md and .env.example."
  );
}

const secret = new TextEncoder().encode(AUTH_SECRET);
```

Keep `COOKIE`, the `Session` interface, and all three exported functions
exactly as they are.

The 32-character floor is a deliberate guard: it rejects the old
`"dev-secret"` fallback shape and any hand-typed placeholder, without needing
to name any specific value.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "dev-secret" src/lib/auth.ts` → no matches
- `grep -rn "dev-secret" src/` → no matches anywhere

### Step 2: Generate a per-installation secret in `main.js`

Add a `setupAuthSecret()` function modelled on the existing `setupDatabase()`
at `main.js:31-53`. It should:

- resolve a path under the existing `userDataPath` (a sibling of the
  `database` folder — e.g. `path.join(userDataPath, 'config', 'auth.key')`),
- create the containing directory with `fs.mkdirSync(..., { recursive: true })`
  if absent,
- if the file does not exist, write a freshly generated secret to it using
  `require('crypto').randomBytes(48).toString('base64')`,
- read the file back and return the value,
- log only that the key was created or loaded — **never log the value itself**.

Then pass it into the fork env at `main.js:82-88`:

```js
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: `file:${dbPath}`,
      AUTH_SECRET: authSecret,
      NODE_ENV: 'production'
    },
```

Call `setupAuthSecret()` from the `app.on('ready')` handler at `main.js:145-147`,
right after `setupDatabase()`, and hold the result in a module-scope variable
that `startNextServer` can read.

Note the guard at the top of `startNextServer` (`main.js:72-75`): in
development (`!app.isPackaged`) it returns early and never forks, so the dev
server continues to read `.env` as it does today. That is correct and should
stay.

**Verify**:
- `node --check main.js` → exit 0
- `grep -n "AUTH_SECRET" main.js` → appears in the fork env block
- `grep -n "randomBytes" main.js` → present
- `grep -niE "writeLog\(.*(authSecret|secretValue)" main.js` → no matches
  (the value is never written to the log)

### Step 3: Stop packaging `.env` into the installer

In `package.json`, change the `build.files` array to exclude the env file from
the standalone copy:

```json
    "files": [
      "main.js",
      ".next/standalone/**/*",
      "!.next/standalone/**/.env*",
      "public/**/*",
      "!node_modules/**/*"
    ]
```

electron-builder applies negation patterns in order, so the `!` entry must come
after the include it narrows.

**Verify**:
- `node -e "const p=require('./package.json');console.log(JSON.stringify(p.build.files))"`
  → the array contains `"!.next/standalone/**/.env*"` positioned after
  `".next/standalone/**/*"`
- `node -e "require('./package.json')"` → exit 0 (the JSON is still valid)

Do not run the full electron build to verify this; it writes 700MB+ of output
to `D:/manovr-build-dist`. Plan 012 covers the packaging size problem
separately.

### Step 4: Remove `.env` from the source-code backup zip

In `src/lib/backup.ts`, edit the `configFiles` array at line 83 to drop `.env`:

```ts
  // فایل‌های پیکربندی کلیدی پروژه (بدون .env — کلید امضای نشست نباید در پشتیبان قرار گیرد)
  const configFiles = ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts"];
```

Keep the rest of `performSourceCodeBackup` unchanged, including the
`zip.addLocalFolder` calls and the audit entry.

**Verify**:
- `grep -n '"\.env"' src/lib/backup.ts` → no matches
- `npx tsc --noEmit` → exit 0

### Step 5: Add `.env.example` and document the requirement

Create `.env.example` at the repo root with placeholder values only — no real
credentials:

```
# Prisma datasource. For local development this is the SQLite file under prisma/.
# The packaged Electron app overrides this at runtime (see main.js).
DATABASE_URL="file:./dev.db"

# Signing key for session JWTs (HS256). REQUIRED — the server refuses to start
# without it. Must be at least 32 characters of high-entropy random data.
# Generate one with:  node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
# Never commit a real value. The packaged app generates its own per installation.
AUTH_SECRET=""
```

`.gitignore:34` uses the pattern `.env*`, which would also ignore
`.env.example`. Add a negation so the example file is tracked:

```
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

Then add a short "Setup" note to `README.md` stating that `AUTH_SECRET` is
required, how to generate one, and that the server will not start without it.
Keep it to a handful of lines — plan 012 rewrites the README properly.

**Verify**:
- `test -f .env.example && echo OK` → `OK`
- `git check-ignore -q .env.example; echo $?` → `1` (meaning: not ignored)
- `grep -c "AUTH_SECRET" README.md` → at least 1

### Step 6: Record the rotation requirement

The secret currently in `.env` has shipped inside at least one installer
(`.next/standalone/.env` is packaged by the glob this plan just fixed).
Removing it from future builds does not un-ship it.

Add a short `## Security note` section to `README.md` stating:

- the previously used `AUTH_SECRET` must be treated as compromised and replaced
  with a freshly generated value on every existing deployment,
- rotating it signs out every user immediately (12h JWTs, `src/lib/auth.ts:21`)
  and each will need to log in again,
- installations that have already run the new `main.js` generate their own key
  and are unaffected by the rotation of the old shared one.

Do not put any secret value in that section.

**Verify**: `grep -n "Security note" README.md` → present.

### Step 7: Add a regression test for the guard

Create `src/lib/__tests__/auth-secret.test.ts`. It must **not** import
`@/lib/auth` at the top level — the module throws on import when the env var is
missing, which is the behaviour under test. Use `vi.resetModules()` plus a
dynamic `await import()` inside each case, and restore `process.env.AUTH_SECRET`
afterwards.

Required cases:
- Importing the module with `AUTH_SECRET` unset rejects/throws
- Importing with a short value (fewer than 32 characters) rejects/throws
- Importing with a 48-character random value succeeds and exposes
  `createSession`, `getSession`, `destroySession`

Use a locally generated throwaway string for the passing case — for example
`"x".repeat(48)` — never a value copied from `.env`.

Sketch:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL = process.env.AUTH_SECRET;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env.AUTH_SECRET = ORIGINAL;
});

describe("auth module secret guard", () => {
  it("refuses to load without AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    await expect(import("@/lib/auth")).rejects.toThrow(/AUTH_SECRET/);
  });
  // ...
});
```

> `src/lib/auth.ts` imports `next/headers`. Under Vitest's `node` environment
> that import resolves but the `cookies()` call would fail outside a request
> scope — which is fine, because these tests only exercise module load, never
> call `cookies()`. If the bare import itself fails, that is a STOP condition.

**Verify**: `npm run test:run` → all pass, including the 3 new cases.

### Step 8: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

`npm run build` requires `AUTH_SECRET` to be set in your shell or in `.env`,
since `src/lib/auth.ts` now throws at import time and the build imports it.
That is intended. If the build fails with the new error message, set the
variable and retry once.

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/auth-secret.test.ts`, covering the three cases in
  Step 7.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` created by
  plan 001 — explicit `import { describe, it, expect } from "vitest"`, one
  `describe` block, English test names.
- No test is written for `main.js`; it is Electron main-process code with no
  test harness in this repo. It is covered by the `node --check` and `grep`
  verifications in Step 2.
- Verification: `npm run test:run` → exit 0, 3 new passing cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "dev-secret" src/ main.js` returns no matches
- [ ] `grep -n "AUTH_SECRET" main.js` shows it in the fork `env` block
- [ ] `grep -n "randomBytes" main.js` returns a match
- [ ] `grep -n '"\.env"' src/lib/backup.ts` returns no matches
- [ ] `node -e "const p=require('./package.json');process.exit(p.build.files.includes('!.next/standalone/**/.env*')?0:1)"` exits 0
- [ ] `test -f .env.example` succeeds and `git check-ignore -q .env.example` exits 1
- [ ] `grep -q "Security note" README.md` succeeds
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the 3 new auth-secret cases
- [ ] `npm run build` exits 0 with `AUTH_SECRET` set
- [ ] No secret value appears in the diff:
      `git diff | grep -iE "AUTH_SECRET\s*=\s*[\"'][^\"']{8,}"` returns no matches
      (the `.env.example` line assigns an empty string and will not match)
- [ ] `git status --porcelain` lists only files from the "In scope" list
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- `npm run build` fails for a reason other than `AUTH_SECRET` being unset.
- Making the packaging change requires editing `scripts/build.js`.
- You discover another code path that reads `AUTH_SECRET` or constructs a
  signing key. Search first: `grep -rn "AUTH_SECRET\|SignJWT\|jwtVerify" src/ main.js scripts/`.
  Today the only signer and verifier are in `src/lib/auth.ts`. If that is no
  longer true, report before changing anything.
- Importing `@/lib/auth` inside a Vitest test throws for a reason unrelated to
  the new guard (for example a `next/headers` resolution error). Report it;
  do not start mocking `next/headers`.
- You are tempted to edit `.env`, delete it, or move it. Don't. Rotation is an
  operator action.

## Maintenance notes

- **The server now refuses to start without `AUTH_SECRET`.** That is the point,
  but it changes the failure mode from "silently insecure" to "loud crash on
  boot". Anyone running `npm run dev`, `npm run build`, or CI for the first
  time after this lands needs the variable set. The error message names
  `.env.example`; keep it accurate if that file moves.
- Rotating the secret signs everyone out. If a future plan lengthens the token
  lifetime beyond 12h (`src/lib/auth.ts:21`), the blast radius of a rotation
  grows with it.
- A reviewer should scrutinise: that no secret value appears anywhere in the
  diff, that `main.js` never logs the generated key, and that the
  electron-builder negation pattern sits *after* the include it narrows.
- The generated per-installation key lives in the user's `userData` directory
  in plaintext, readable by that user. For a single-operator desktop
  deployment that is proportionate. If this ever becomes a shared or networked
  install, the key needs to move to OS credential storage — that is a separate
  decision, not a follow-up chore.
- Deferred out of this plan: the role checks in
  `src/app/api/admin/backups/route.ts` that still use raw `session.role !== 4`
  instead of `hasPerm`. That is part of the broader role→permission migration
  noted in `plans/README.md`.
