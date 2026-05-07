# Login & Dashboard Access Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the `index.html` dashboard behind a login page, with credentials from `.env`, using a Node.js HTTP server with session cookies.

**Architecture:** A new `src/server.js` module exports `startDashboardServer()`, which creates a `node:http` server that serves `login.html` to unauthenticated requests and `index.html` to authenticated ones. Sessions are stored as a `Set<string>` of UUID tokens in memory. `index.js` calls `startDashboardServer()` at the top of `main()` before the polling loop.

**Tech Stack:** Node.js built-ins only — `node:http`, `node:fs`, `node:crypto`, `node:path`, `node:url`. No new npm dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.env` | Create | Local credentials (not committed) |
| `.env.example` | Create | Documents env vars (committed, no real values) |
| `src/config.js` | Modify | Add `dashboard` section |
| `src/server.js` | Create | HTTP server, routing, session management |
| `src/login.html` | Create | Login page UI |
| `src/index.js` | Modify | Call `startDashboardServer()` in `main()` |

---

## Task 1: Create `.env` and `.env.example`

**Files:**
- Create: `.env`
- Create: `.env.example`

- [ ] **Step 1: Create `.env` with dashboard credentials**

Create `.env` in the project root (already in `.gitignore` — safe):

```
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=changeme
DASHBOARD_PORT=3000
```

- [ ] **Step 2: Create `.env.example`**

Create `.env.example` in the project root:

```
# Dashboard login
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=
DASHBOARD_PORT=3000

# Polymarket
POLYMARKET_SLUG=
POLYMARKET_SERIES_ID=10192
POLYMARKET_SERIES_SLUG=btc-up-or-down-15m
POLYMARKET_AUTO_SELECT_LATEST=true
POLYMARKET_LIVE_WS_URL=wss://ws-live-data.polymarket.com
POLYMARKET_UP_LABEL=Up
POLYMARKET_DOWN_LABEL=Down

# Chainlink / Polygon
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_RPC_URLS=
POLYGON_WSS_URL=
POLYGON_WSS_URLS=
CHAINLINK_BTC_USD_AGGREGATOR=0xc907E116054Ad103354f2D350FD2514433D57F6f

# Paper trading
PAPER_ENABLED=false
PAPER_STARTING_BALANCE=1000
PAPER_BET_PCT=5
PAPER_MIN_ENTRY_PRICE=0.50
PAPER_MAX_ENTRY_PRICE=0.65
PAPER_TAKE_PROFIT_PCT=20
PAPER_TP_EARLY_MINUTES=10
PAPER_TP_LATE_MINUTES=5
PAPER_TP_EARLY_MULTIPLIER=2.0
PAPER_TP_LATE_MULTIPLIER=0.6
PAPER_TP_EDGE_STRONG_THRESHOLD=0.30
PAPER_TP_EDGE_STRONG_BONUS=0.30
PAPER_STOP_LOSS_PCT=25
PAPER_STOP_LOSS_EARLY_MINUTES=10
PAPER_EDGE_EXIT_THRESHOLD=-0.02
PAPER_EDGE_EXIT_EARLY_THRESHOLD=-0.20
PAPER_EARLY_MINUTES=10
PAPER_FLIP_MIN_PROB=0.75
PAPER_FLIP_MIN_EDGE=0.20
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example with dashboard credentials"
```

---

## Task 2: Add `dashboard` section to `src/config.js`

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Add `dashboard` block at the end of the CONFIG object**

In `src/config.js`, add the following block before the closing `};` (after the `paper` block):

```js
  dashboard: {
    user: process.env.DASHBOARD_USER || "admin",
    password: process.env.DASHBOARD_PASSWORD || "",
    port: Number(process.env.DASHBOARD_PORT || "3000")
  }
```

The final few lines of `src/config.js` should look like:

```js
  paper: {
    // ... existing paper config unchanged ...
    flipMinEdge: Number(process.env.PAPER_FLIP_MIN_EDGE || "0.20")
  },

  dashboard: {
    user: process.env.DASHBOARD_USER || "admin",
    password: process.env.DASHBOARD_PASSWORD || "",
    port: Number(process.env.DASHBOARD_PORT || "3000")
  }
};
```

- [ ] **Step 2: Verify the file parses without errors**

```bash
node --input-type=module <<'EOF'
import { CONFIG } from "./src/config.js";
console.log(CONFIG.dashboard);
EOF
```

Expected output:
```
{ user: 'admin', password: 'changeme', port: 3000 }
```

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat: add dashboard config section"
```

---

## Task 3: Create `src/login.html`

**Files:**
- Create: `src/login.html`

- [ ] **Step 1: Create the login page**

Create `src/login.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      background: #0a0a0a;
      color: #e8e8e8;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card {
      width: 320px;
      border: 1px solid #222;
      background: #111;
      padding: 32px;
    }

    h1 {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 24px;
    }

    label {
      display: block;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 6px;
    }

    input {
      display: block;
      width: 100%;
      background: #0a0a0a;
      border: 1px solid #222;
      color: #e8e8e8;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
      padding: 8px 10px;
      outline: none;
      margin-bottom: 16px;
    }

    input:focus {
      border-color: #448aff;
    }

    button {
      display: block;
      width: 100%;
      background: #e8e8e8;
      color: #0a0a0a;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      border: none;
      padding: 10px;
      cursor: pointer;
      margin-top: 8px;
    }

    button:hover {
      background: #fff;
    }

    .error {
      display: none;
      font-size: 11px;
      color: #ff3b30;
      margin-top: 14px;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Login</h1>
    <form method="POST" action="/login">
      <label for="username">Username</label>
      <input id="username" type="text" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" type="password" name="password" autocomplete="current-password" required>
      <button type="submit">Enter</button>
      <p class="error" id="err">Invalid credentials</p>
    </form>
  </div>
  <script>
    if (new URLSearchParams(location.search).get('error') === '1') {
      document.getElementById('err').style.display = 'block';
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser to verify visuals**

Open `src/login.html` directly in a browser (file://) and confirm:
- Dark background, mono font, centered card
- Username and Password fields visible
- No error message shown by default

- [ ] **Step 3: Commit**

```bash
git add src/login.html
git commit -m "feat: add login page HTML"
```

---

## Task 4: Create `src/server.js`

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: Create the HTTP server module**

Create `src/server.js`:

```js
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sessions = new Set();

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookies[k.trim()] = v.join("=").trim();
  }
  return cookies;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies.session && sessions.has(cookies.session);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const params = new URLSearchParams(body);
      resolve({ username: params.get("username") || "", password: params.get("password") || "" });
    });
  });
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

export function startDashboardServer() {
  const { user, password, port } = CONFIG.dashboard;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;
    const method = req.method;

    if (method === "GET" && pathname === "/login") {
      serveFile(res, path.join(__dirname, "login.html"), "text/html");
      return;
    }

    if (method === "POST" && pathname === "/login") {
      const { username, password: pw } = await parseBody(req);
      if (username === user && pw === password) {
        const token = crypto.randomUUID();
        sessions.add(token);
        res.writeHead(302, {
          "Set-Cookie": `session=${token}; HttpOnly; SameSite=Strict; Path=/`,
          "Location": "/"
        });
        res.end();
      } else {
        res.writeHead(302, { "Location": "/login?error=1" });
        res.end();
      }
      return;
    }

    if (method === "GET" && pathname === "/logout") {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies.session) sessions.delete(cookies.session);
      res.writeHead(302, {
        "Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        "Location": "/login"
      });
      res.end();
      return;
    }

    if (method === "GET" && pathname === "/") {
      if (!isAuthenticated(req)) {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return;
      }
      serveFile(res, path.join(__dirname, "index.html"), "text/html");
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, "127.0.0.1", () => {
    process.stderr.write(`Dashboard: http://127.0.0.1:${port}\n`);
  });

  return server;
}
```

- [ ] **Step 2: Verify the module imports cleanly**

```bash
node --input-type=module <<'EOF'
import { startDashboardServer } from "./src/server.js";
console.log(typeof startDashboardServer);
EOF
```

Expected output:
```
function
```

- [ ] **Step 3: Commit**

```bash
git add src/server.js
git commit -m "feat: add HTTP dashboard server with session auth"
```

---

## Task 5: Integrate server into `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Add import at the top of `src/index.js`**

After the existing imports (around line 29, after the `renderPaperSection` import), add:

```js
import { startDashboardServer } from "./server.js";
```

- [ ] **Step 2: Call `startDashboardServer()` at the top of `main()`**

In `src/index.js`, `main()` starts at line 400. Add the call as the very first line inside `main()`:

```js
async function main() {
  startDashboardServer();

  const binanceStream = startBinanceTradeStream({ symbol: CONFIG.symbol });
  // ... rest unchanged
```

- [ ] **Step 3: Run the app and verify the server starts**

```bash
npm start
```

Expected: terminal shows `Dashboard: http://127.0.0.1:3000` at startup (on stderr, alongside the normal CLI output). Open `http://127.0.0.1:3000` in a browser — should redirect to `http://127.0.0.1:3000/login`.

- [ ] **Step 4: Test the full login flow manually**

1. Go to `http://127.0.0.1:3000` → redirected to `/login` ✓
2. Submit wrong credentials → back to `/login?error=1` with "Invalid credentials" message ✓
3. Submit correct credentials (from `.env`) → redirected to `/` → dashboard visible ✓
4. Go to `http://127.0.0.1:3000/logout` → redirected to `/login`, cookie cleared ✓

- [ ] **Step 5: Commit**

```bash
git add src/index.js
git commit -m "feat: start dashboard server on app launch"
```
