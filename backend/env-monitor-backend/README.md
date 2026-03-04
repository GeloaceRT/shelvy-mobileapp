# Environmental Monitoring Backend

This backend collects sensor readings (humidity and temperature), stores them in Firebase Realtime Database, and provides authentication and alerting services for mobile/web clients.

Quick overview
- Language: TypeScript
- Entry point: `src/app.ts`
- Run locally with `npm run dev` (uses `tsx` watch) or `npm start` for a one-shot run

Prerequisites
- Node.js (LTS recommended)
- npm
- A Firebase project (Realtime Database) or a Prisma-compatible database if using Prisma features

Install

```powershell
npm install
```

Configuration / Environment

Create a `.env` file at the project root (or export env vars in your shell). Minimum variables used by the app:

- `FIREBASE_PROJECT_ID` — Firebase project id
- `FIREBASE_DATABASE_URL` — Realtime Database URL (e.g. `https://<project>.firebaseio.com`)
- `FIREBASE_API_KEY` — Firebase Web API key (used for client token exchange)
- `FIREBASE_ADMIN_CREDENTIALS` — path to service account JSON file or the JSON string itself. If you keep the file in repo during development use `env-monitor-backend/firebase-service-account.json`.
- `PORT` — optional server port (defaults in code)
- `DEVICE_SECRET` — prototype device secret used for `x-device-secret` header
- `USE_PRISMA` / `DATABASE_URL` — set if using Prisma-backed storage

Common tasks

- Run in development (auto-reload):

```powershell
npm run dev
```

- Start (one-shot):

```powershell
npm start
```

- Run tests:

```powershell
npm test
```

Helpful scripts
- `scripts/run-local.ps1` and `scripts/run-prod.ps1` provide convenient PowerShell wrappers for local and production runs.
- `scripts/seed-alerts.ts` seeds example alerts into the database.
- `scripts/create-firebase-user.ts` demonstrates creating a Firebase user via the Admin SDK.

Database / Prisma

If you enable Prisma (`USE_PRISMA=true` and `DATABASE_URL` set), run migrations and generate client before starting:

```powershell
npx prisma generate
npx prisma migrate deploy   # or `migrate dev` for development
```

Endpoints (high level)

- `POST /api/auth/signup` — create user (body: `email`, `password`, `firstName`, `lastName`). Backend will create a Firebase account and a profile record.
- `POST /api/auth/signin` — login; response may include a custom Firebase token which clients should exchange for an ID token with Firebase client SDK.
- `GET /api/users/me` — protected; requires `Authorization: Bearer <ID_TOKEN>` header
- `POST /api/readings/:deviceId` — device ingestion. Prototype devices should send `x-device-secret: <DEVICE_SECRET>` header and JSON body `{ ts, temperature, humidity, meta }`.

Device ingestion notes

- `ts` should be milliseconds since epoch. The server supports batch ingestion with `readings: [ ... ]`.

Examples (HTTPie)

Signup:

```powershell
http POST http://localhost:4000/api/auth/signup email=user@example.com password=Pass123 firstName=Jane lastName=Doe
```

Device ingest:

```powershell
http --json POST http://localhost:4000/api/readings/esp32-01 \
  x-device-secret:dev-device-secret-please-change ts:=1670000000000 temperature:=24 humidity:=47 meta:='{"battery":95}'
```

Security

- The backend uses the Firebase Admin SDK for server-side writes. Make sure you keep the Admin service account credentials private.
- If the frontend will read protected RTDB paths directly, add appropriate RTDB rules (e.g. `auth != null && auth.uid === $uid`).

Contributing

- Open a PR against `geloace-test` or `main` following existing project conventions.

License: MIT