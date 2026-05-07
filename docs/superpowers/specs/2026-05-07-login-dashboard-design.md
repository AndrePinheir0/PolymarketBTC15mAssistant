# Login & Dashboard Access Control — Design Spec

**Date:** 2026-05-07  
**Status:** Approved

## Overview

Add a login page that gates access to the existing `index.html` dashboard. Authentication uses credentials stored in `.env`. A lightweight HTTP server (Node.js built-ins only) handles all routing and session management.

## Environment Variables

Three new variables added to `.env` (already in `.gitignore`, never committed):

```
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=secret
DASHBOARD_PORT=3000
```

A `.env.example` file (committed, no real values) documents these variables alongside existing ones.

`config.js` exposes them as:
```js
dashboard: {
  user: process.env.DASHBOARD_USER || "admin",
  password: process.env.DASHBOARD_PASSWORD || "",
  port: Number(process.env.DASHBOARD_PORT || "3000")
}
```

## HTTP Server (`src/server.js`)

- Built with `node:http`, `node:fs`, `node:crypto` — zero new dependencies
- Sessions stored as a `Set<string>` of tokens in memory (cleared on process restart)
- Token generated via `crypto.randomUUID()`

**Routes:**

| Method | Path | Behaviour |
|--------|------|-----------|
| GET | `/` | Valid session cookie → serve `index.html`; otherwise redirect to `/login` |
| GET | `/login` | Serve `login.html` |
| POST | `/login` | Validate user+password from form body against `CONFIG.dashboard`; success → set `session` cookie (HttpOnly, SameSite=Strict) + redirect to `/`; failure → redirect to `/login?error=1` |
| GET | `/logout` | Remove session token from Set + redirect to `/login` |
| * | `*` | 404 |

Cookie format: `session=<uuid>; HttpOnly; SameSite=Strict; Path=/`

## Login Page (`src/login.html`)

- Standalone HTML, no external JS
- Visual theme matches `index.html`: background `#0a0a0a`, IBM Plex Mono font, dark palette
- Title: **"Login"**
- Form fields: Username (`text`), Password (`password`)
- Submit button: "Enter"
- Error message shown only when `?error=1` is present in the URL (e.g. "Invalid credentials") — detected via inline `<script>` that reads `URLSearchParams`
- Form action: `POST /login`, encoding: `application/x-www-form-urlencoded`

## Integration

`index.js` `main()` calls `startDashboardServer()` (exported from `server.js`) before the polling loop begins. The server runs concurrently with the CLI loop — no blocking.

## Out of Scope

- HTTPS (local use only)
- Rate limiting / brute-force protection
- Persistent sessions across restarts
- Multiple users
