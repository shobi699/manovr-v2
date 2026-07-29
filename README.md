# Manovr System (v3)

Terminal Maneuver & Fleet Management System for Fath-Abad Rail Depot.
Built as an offline Windows desktop application (Electron + Next.js standalone server + SQLite).

## Prerequisites

- Node.js 20+
- npm 10+
- Windows OS (for Electron desktop package builds)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env` file from `.env.example`:
```bash
AUTH_SECRET="your-32-plus-character-secret"
DATABASE_URL="file:./dev.db"
```
Generate `AUTH_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

3. Initialize local database and seed data:
```bash
npx prisma db push
node prisma/seed-v3.mjs
```

## Development

Start local Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Verification & Quality Gates

Run checks before committing:
```bash
npx tsc --noEmit
npm run lint
npm run test:run
```

## Building Desktop Application

Build Electron executable & installer:
```bash
npm run build:electron
```
Output packages are generated at `D:/manovr-build-dist` and copied to the root folder.
Packaged Electron installations run `main.js`, which generates an isolated per-installation key automatically under AppData.

## Project Conventions

- **RTL & Persian UI**: All interface text and layout follow RTL (`dir="rtl"`) with `Asia/Tehran` timezone.
- **Security & Authorization**: Access permissions use `hasPerm(session, permission)` guards in Server Actions.
- **Guidelines**: See `CLAUDE.md` and `AGENTS.md` for coding rules and guidelines.

## Security Note

- Any previously hardcoded or shared `AUTH_SECRET` must be treated as compromised and replaced with a freshly generated value on existing deployments.
- Rotating `AUTH_SECRET` invalidates all outstanding sessions (12h JWT tokens), requiring users to log in again.
- Electron packaged installations run `main.js`, which generates an isolated per-installation key automatically.
