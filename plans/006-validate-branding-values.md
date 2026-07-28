# Plan 006: Validate branding values before they reach the root `<style>` tag

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

The root layout injects the branding accent colour into a `<style>` element
using `dangerouslySetInnerHTML`, interpolating the stored value three times
with no escaping or validation. The value comes from the database, written by
`saveBrandingSettings`, which stores whatever object it is handed as JSON
without checking any field's shape.

So a holder of the `branding.manage` permission controls raw text inside a
`<style>` element that renders on **every page for every user**, including
super-admins. That is enough for arbitrary CSS (repositioning or hiding
controls, overlaying content, exfiltrating data through attribute selectors and
background-image requests) and, because the content is not escaped, for
terminating the `<style>` element early and emitting arbitrary markup after it.

`branding.manage` is not the top privilege in this system — it is a delegable
permission for someone who should be able to change a logo and an announcement
banner. It should not be a path to controlling what every other user's browser
renders.

The same value also flows to a client-side sink and the logo flows into an
`<img src>`; both are covered here because fixing one interpolation while
leaving the sibling paths unvalidated just moves the problem.

## Current state

### Sink 1 — `src/app/layout.tsx:34-48`, the root `<style>`

```tsx
  const branding = await getBrandingSettings();
  const accentColor = branding.accentColor || "#d8842a";

  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="stylesheet" href="/fonts/font-face.css" />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --accent: ${accentColor} !important;
            --accent-soft: ${accentColor}14 !important;
            --accent-hover: ${accentColor}d9 !important;
          }
        ` }} />
      </head>
```

Note the `14` and `d9` suffixes: the code assumes `accentColor` is a 6-digit
hex string so that appending two hex digits yields an 8-digit RGBA hex. Any
other format silently produces invalid CSS even without malice.

### Sink 2 — `src/components/Sidebar.tsx:47-55`, the live SSE repaint

```tsx
          const accentColor = payload.data.accentColor || "#d8842a";
          document.documentElement.style.setProperty("--accent", accentColor, "important");
          document.documentElement.style.setProperty("--accent-soft", `${accentColor}14`, "important");
          document.documentElement.style.setProperty("--accent-hover", `${accentColor}d9`, "important");
```

`setProperty` goes through the CSSOM, which will reject a syntactically invalid
value rather than execute anything — so this sink is materially safer than
sink 1. It is still fed unvalidated data and should get the same treatment for
consistency.

### Sink 3 — `src/components/Sidebar.tsx:182-183`, the logo

```tsx
            {branding.logoType === "image" && branding.logoImage ? (
              <img src={branding.logoImage} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
```

`logoImage` is produced by a file upload converted to a base64 data URL at
`src/app/(main)/admin/branding/BrandingClient.tsx:62`:

```tsx
      setSettings((prev) => ({ ...prev, logoImage: base64 }));
```

But the server action accepts any string. There is also a preview `<img>` at
`BrandingClient.tsx:188` and `:308`.

### The write boundary — `src/app/actions/lookups.ts:139-175`

```ts
export async function saveBrandingSettings(settings: {
  title: string;
  footer: string;
  logoIcon: string;
  logoType: "icon" | "image";
  logoImage: string;
  accentColor: string;
  announcementText: string;
  announcementKind: "info" | "success" | "warning" | "alert";
  announcementActive: boolean;
}) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "branding.manage"))) {
    return { ok: false, error: "عدم دسترسی کافی" };
  }

  try {
    const beforeSettings = await getBrandingSettings();

    await prisma.appSetting.upsert({
      where: {
        scope_userId_key: {
          scope: "global",
          userId: 0,
          key: "branding",
        },
      },
      update: {
        value: JSON.stringify(settings),
      },
      create: {
        scope: "global",
        userId: 0,
        key: "branding",
        value: JSON.stringify(settings),
      },
    });
```

The TypeScript parameter type is documentation, not enforcement — this is a
server action, so the argument arrives over the network and is whatever the
caller sent. `JSON.stringify(settings)` persists it verbatim.

### The read boundary — `src/app/actions/lookups.ts:198-237`

```ts
export async function getBrandingSettings() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: {
        scope_userId_key: {
          scope: "global",
          userId: 0,
          key: "branding",
        },
      },
    });
    if (setting) {
      const data = JSON.parse(setting.value);
      return {
        title: data.title ?? "سامانه مدیریت مانور",
        footer: data.footer ?? "پایانه فتح‌آباد · v3",
        logoIcon: data.logoIcon ?? "🚇",
        logoType: data.logoType ?? "icon",
        logoImage: data.logoImage ?? "",
        accentColor: data.accentColor ?? "#d8842a",
        announcementText: data.announcementText ?? "",
        announcementKind: data.announcementKind ?? "info",
        announcementActive: data.announcementActive ?? false,
      };
    }
  } catch {}

  // مقادیر پیش‌فرض
  return {
    title: "سامانه مدیریت مانور",
    footer: "پایانه فتح‌آباد · v3",
    logoIcon: "🚇",
    logoType: "icon",
    logoImage: "",
    accentColor: "#d8842a",
    announcementText: "",
    announcementKind: "info",
    announcementActive: false,
  };
}
```

`??` only substitutes for `null`/`undefined` — a stored string of any shape
passes straight through. This is why validation is needed at **both**
boundaries: the write guard protects future values, the read guard neutralises
anything already stored.

### What is already safe and must stay that way

`announcementText` is rendered as a React child at
`src/app/(main)/layout.tsx:40`:

```tsx
            <span style={{ flex: 1 }}>{branding.announcementText}</span>
```

React escapes text children, so that is not a sink. Do not "fix" it, and do not
introduce `dangerouslySetInnerHTML` anywhere new.

`title` and `footer` are likewise rendered as text children in
`src/components/Sidebar.tsx`. They get length limits in this plan but not
escaping — React already handles that.

### The default value used throughout

`#d8842a` is the accent default. It appears at `src/app/layout.tsx:35`,
`src/components/Sidebar.tsx:52`, `src/app/actions/lookups.ts:217` and `:232`,
and `src/app/(main)/admin/branding/BrandingClient.tsx:42`. Use the same literal
as the fallback when validation rejects a value.

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
- `src/lib/branding.ts` (create — the validators)
- `src/app/actions/lookups.ts` — `saveBrandingSettings` and
  `getBrandingSettings` only
- `src/components/Sidebar.tsx` — the SSE accent handler at lines 47-55 only
- `src/lib/__tests__/branding.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/app/layout.tsx`. Once `getBrandingSettings` can only return a validated
  colour, the interpolation is safe. Do not restructure the `<style>` tag, do
  not move to a CSS variable set via a `style` prop, do not add a nonce. Those
  are larger changes with their own tradeoffs.
- `src/app/(main)/admin/branding/BrandingClient.tsx`. Client-side validation is
  not the boundary being fixed. The existing `<input type="color">` at line 205
  already produces valid hex for honest users.
- `announcementText`, `announcementKind`, and the banner rendering in
  `src/app/(main)/layout.tsx`. Already safe via React escaping.
- The other functions in `src/app/actions/lookups.ts` — `getLookupTypes`,
  `saveLookupValue`, `deleteLookupValue`. `LookupValue.color` is a separate
  field with its own render path; if it needs the same treatment that is a
  follow-up, not this plan.
- The `branding_changed` SSE payload shape. Plan 004 explicitly leaves it
  intact because `Sidebar.tsx:52` consumes it.

## Git workflow

- Branch: `advisor/006-validate-branding-values`
- Plain imperative commit subjects, e.g. `Validate branding accent colour`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the validators

Create `src/lib/branding.ts`. It must import nothing — pure string functions, so
it is usable from both server actions and the client component in Step 4.

```ts
// اعتبارسنجی مقادیر برندینگ پیش از تزریق در CSS و DOM.
// این مقادیر توسط دارنده مجوز branding.manage تعیین می‌شوند و در تمام صفحات
// برای همه کاربران رندر می‌شوند؛ بنابراین باید در هر دو مرز خواندن و نوشتن
// اعتبارسنجی شوند.

export const DEFAULT_ACCENT_COLOR = "#d8842a";

// دقیقاً شش رقم هگز با # — چون کد رندر دو رقم شفافیت به انتهای آن اضافه می‌کند
const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function isValidAccentColor(value: unknown): value is string {
  return typeof value === "string" && HEX6.test(value);
}

export function safeAccentColor(value: unknown): string {
  return isValidAccentColor(value) ? value : DEFAULT_ACCENT_COLOR;
}

// فقط data URL تصویری یا مسیر نسبی هم‌ریشه پذیرفته می‌شود
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const RELATIVE_PATH = /^\/[A-Za-z0-9._\-/]*$/;

export function safeLogoImage(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  if (DATA_IMAGE.test(value)) return value;
  if (RELATIVE_PATH.test(value)) return value;
  return "";
}

// متن‌های ساده — فقط محدودیت طول؛ React خودش escape می‌کند
export function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength);
}
```

Two deliberate choices worth understanding rather than changing:

- **Exactly six hex digits, not 3, 4, or 8.** The render code appends `14` and
  `d9` to build the soft and hover variants (`src/app/layout.tsx:43-45`). A
  3-digit or 8-digit value would produce nonsense CSS even though it is a valid
  colour in isolation.
- **`svg+xml` is allowed in the data-URL pattern** because an SVG rendered
  through `<img src>` cannot execute script — browsers block scripting in
  images. It is included because SVG logos are a reasonable thing to upload. If
  the logo ever moves to an inline `<svg>` or a CSS `background-image` on an
  element that isn't an `<img>`, remove it.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "^import" src/lib/branding.ts` → 0 (no imports; safe on both sides)

### Step 2: Validate at the write boundary

In `src/app/actions/lookups.ts`, inside `saveBrandingSettings`, build a
sanitised object and persist **that** instead of the raw `settings` argument.
Insert after the permission check and before the `upsert`:

```ts
    // مقادیر ورودی از سمت کلاینت می‌آیند و نوع TypeScript تضمینی ایجاد نمی‌کند
    const safeSettings = {
      title: safeText(settings.title, 120),
      footer: safeText(settings.footer, 200),
      logoIcon: safeText(settings.logoIcon, 8),
      logoType: settings.logoType === "image" ? "image" : "icon",
      logoImage: safeLogoImage(settings.logoImage),
      accentColor: safeAccentColor(settings.accentColor),
      announcementText: safeText(settings.announcementText, 500),
      announcementKind: (["info", "success", "warning", "alert"] as const).includes(
        settings.announcementKind
      )
        ? settings.announcementKind
        : "info",
      announcementActive: settings.announcementActive === true,
    };
```

Then replace **both** occurrences of `JSON.stringify(settings)` (in the
`update` block at line 167 and the `create` block at line 173) with
`JSON.stringify(safeSettings)`.

Also update the two downstream uses so they reflect what was actually stored:
the `audit(...)` call at lines 178-186 passes `settings` as the "after" value,
and `emitSSEEvent("branding_changed", settings)` at line 189 broadcasts it.
Both should pass `safeSettings`. The SSE one matters functionally — otherwise
`Sidebar.tsx:52` would repaint with the rejected value until the next reload.

Add the import at the top of the file:

```ts
import { safeAccentColor, safeLogoImage, safeText } from "@/lib/branding";
```

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -c "JSON.stringify(settings)" src/app/actions/lookups.ts` → 0
- `grep -c "safeSettings" src/app/actions/lookups.ts` → 4 (declaration, two
  stringify calls, audit and emit — count may be 5 depending on how you write
  the audit call; anything above 3 is fine, 0 is not)

### Step 3: Validate at the read boundary

Also in `src/app/actions/lookups.ts`, in `getBrandingSettings`, replace the
bare `??` fallbacks for the two dangerous fields with the validators. Anything
already stored from before this plan gets neutralised on read:

```ts
      return {
        title: safeText(data.title, 120) || "سامانه مدیریت مانور",
        footer: safeText(data.footer, 200) || "پایانه فتح‌آباد · v3",
        logoIcon: safeText(data.logoIcon, 8) || "🚇",
        logoType: data.logoType === "image" ? "image" : "icon",
        logoImage: safeLogoImage(data.logoImage),
        accentColor: safeAccentColor(data.accentColor),
        announcementText: safeText(data.announcementText, 500),
        announcementKind: (["info", "success", "warning", "alert"] as const).includes(
          data.announcementKind
        )
          ? data.announcementKind
          : "info",
        announcementActive: data.announcementActive === true,
      };
```

Leave the default-values `return` block at lines 226-236 exactly as it is — its
literals are already valid.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "accentColor: data.accentColor" src/app/actions/lookups.ts` → no matches
- `grep -n "safeAccentColor(data.accentColor)" src/app/actions/lookups.ts` → present

### Step 4: Validate at the client repaint sink

In `src/components/Sidebar.tsx`, apply the same validator to the SSE-driven
accent update at lines 47-55:

```tsx
          const accentColor = safeAccentColor(payload.data?.accentColor);
```

leaving the three `setProperty` calls below it unchanged. Import from
`@/lib/branding` — the module has no imports of its own, so it is safe in a
client component.

This is defence in depth: after Step 2 the broadcast payload is already
sanitised, but this sink reads a value straight off the network and should not
depend on the emitter having done the right thing.

**Verify**:
- `npx tsc --noEmit` → exit 0
- `grep -n "safeAccentColor" src/components/Sidebar.tsx` → present
- `grep -n 'payload.data.accentColor || "#d8842a"' src/components/Sidebar.tsx` → no matches

### Step 5: Write the tests

Create `src/lib/__tests__/branding.test.ts`.

`isValidAccentColor` / `safeAccentColor` — required cases:
- `"#d8842a"` and `"#FFFFFF"` are accepted
- `"#fff"` (3-digit) is rejected → falls back to the default
- `"#d8842aff"` (8-digit) is rejected — the render code appends its own two
  digits
- `"red"` and `"rgb(0,0,0)"` are rejected
- A `<style>`-breakout string is rejected. Use a benign representative such as
  `"#000; } * { display: none } /*"` — the point is that a value carrying CSS
  syntax does not survive, and asserting on the fallback is the whole test. Do
  not construct anything more elaborate; a longer string does not test more.
- Non-string inputs (`null`, `undefined`, `42`, `{}`) are rejected without
  throwing

`safeLogoImage` — required cases:
- A well-formed `data:image/png;base64,...` value is accepted
- A relative path such as `"/logo.png"` is accepted
- An absolute remote URL such as `"https://example.com/x.png"` is rejected → `""`
- A `javascript:` scheme is rejected → `""`
- `""`, `null`, and non-strings return `""`

`safeText` — required cases:
- Truncates to the given length
- Returns `""` for non-strings
- Leaves a normal Persian string intact (it must not mangle multi-byte text —
  assert a short Persian string round-trips unchanged)

**Verify**: `npm run test:run` → exit 0, all new cases pass.

### Step 6: Confirm at runtime

Start the dev server (`npm run dev`), log in as an account with
`branding.manage`, and open `/admin/branding`.

1. Set a normal colour through the picker and save. Confirm the theme changes
   and `<style>` in the page source contains the chosen 6-digit hex.
2. Confirm the existing behaviour still works end to end: the accent updates
   live in an already-open second tab (that is the `Sidebar.tsx` SSE path).

Then verify the write boundary rejects a bad value. The UI's colour input will
not let you type one, so exercise the server action directly from the browser
console on a page where it is imported, or temporarily set the value via the
form's text input at `BrandingClient.tsx:212` if it accepts free text.

**Verify**: after attempting to save a non-hex accent value, reload and confirm
the rendered `--accent` is `#d8842a`, not the submitted string, and that the
page source contains no injected CSS or markup.

If you cannot exercise the action directly, say so in your report — the unit
tests in Step 5 cover the logic; this step is confirmation, not the proof.

### Step 7: Confirm the full gate

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

**Verify**: all four exit 0.

## Test plan

- New file: `src/lib/__tests__/branding.test.ts` — roughly 15 cases across the
  three validators, as enumerated in Step 5.
- Structural pattern: model after `src/lib/__tests__/perms.test.ts` from plan
  001 — explicit `import { describe, it, expect } from "vitest"`, one `describe`
  per validator, English test names.
- `src/lib/branding.ts` has no imports, so the test file needs no setup and runs
  in milliseconds.
- No test is written for `saveBrandingSettings` / `getBrandingSettings`
  themselves — both call Prisma, and this repo has no database test harness
  (plan 001 deferred one). The validators are the logic worth testing; the
  actions just call them.
- Verification: `npm run test:run` → exit 0, all new cases passing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f src/lib/branding.ts` succeeds
- [ ] `grep -c "^import" src/lib/branding.ts` returns 0
- [ ] `grep -c "JSON.stringify(settings)" src/app/actions/lookups.ts` returns 0
- [ ] `grep -n "safeAccentColor(data.accentColor)" src/app/actions/lookups.ts` returns a match
- [ ] `grep -n "safeAccentColor" src/components/Sidebar.tsx` returns a match
- [ ] `src/app/layout.tsx` is unmodified:
      `git diff --name-only` does not list it
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test:run` exits 0, including the new branding validator cases
- [ ] `npm run build` exits 0
- [ ] Step 6 recorded: a valid colour applies, an invalid one falls back to
      `#d8842a`, live cross-tab repaint still works
- [ ] `git status --porcelain` lists only the In-scope files
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any quoted excerpt under "Current state" no longer matches the live file.
- You find a fourth sink for `accentColor` or `logoImage`. Search:
  `grep -rn "accentColor\|logoImage" src/`. Expected sites are
  `src/app/layout.tsx`, `src/components/Sidebar.tsx`,
  `src/app/actions/lookups.ts`, and
  `src/app/(main)/admin/branding/BrandingClient.tsx`. Anything else is new.
- You find another `dangerouslySetInnerHTML` in the codebase. Search:
  `grep -rn "dangerouslySetInnerHTML" src/`. Exactly one is expected, at
  `src/app/layout.tsx:41`. A second one is a finding this plan does not cover.
- Tightening `logoImage` breaks an existing stored logo — i.e. after your change
  the sidebar logo disappears on a system that had one. Report the stored
  value's prefix (not the whole base64 blob) so the pattern can be widened
  correctly. Do not loosen `safeLogoImage` to a catch-all.
- The live cross-tab accent repaint stops working after Step 2. That would mean
  the `branding_changed` payload shape changed; it should not have.
- You are tempted to restructure `src/app/layout.tsx` — adding a CSP nonce,
  moving to inline `style` props, or removing the `<style>` tag. All are
  reasonable ideas and all are out of scope here.

## Maintenance notes

- **The invariant: `getBrandingSettings` is the only way branding values reach a
  render path, and everything it returns is validated.** That is what makes the
  unescaped interpolation at `src/app/layout.tsx:43-45` safe. If a future change
  reads `AppSetting` with `key: "branding"` directly instead of going through
  the accessor, the guarantee is gone. That is the thing for a reviewer to
  watch.
- The six-digit hex requirement is coupled to the `14` / `d9` suffixes in
  `src/app/layout.tsx:44-45` and `src/components/Sidebar.tsx:54-55`. If someone
  changes how the soft/hover variants are derived — say, moving to
  `color-mix()` — the validator's strictness can relax, but the two must stay in
  sync.
- `LookupValue.color` (`prisma/schema.prisma:157`) is a sibling colour field
  written by `saveLookupValue` (`src/app/actions/lookups.ts:64`) with no
  validation. It currently reaches inline `style` props rather than a raw
  `<style>` tag, so it is a lesser risk — but it is the same shape of problem
  and the validators from this plan are ready for it. Deliberately deferred.
- A reviewer should scrutinise: that validation exists at **both** the write and
  the read boundary. Write-only validation leaves whatever is already in the
  database live; read-only validation lets bad data accumulate. Both were added
  here on purpose.
