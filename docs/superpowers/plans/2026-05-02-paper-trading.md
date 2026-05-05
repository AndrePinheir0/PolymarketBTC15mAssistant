# Paper Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a paper trading layer that simulates UP/DOWN trades on each ENTER signal, tracks a virtual balance starting at $1000, persists state across restarts, and displays a live P&L section in the console.

**Architecture:** A `PaperTrader` factory wraps pure business-logic functions (entry, settlement) with file I/O. The main loop calls `onSignal()` each tick and passes the result to a display function that injects a new section into the existing console render.

**Tech Stack:** Node.js 23 (ESM), `node:test` + `node:assert` for tests, `node:fs` for persistence.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/paper/trader.js` | Pure logic + factory with file I/O |
| Create | `src/paper/display.js` | Render paper trading console section |
| Create | `src/paper/trader.test.js` | Unit tests for pure logic |
| Modify | `src/config.js` | Add `paper` config block |
| Modify | `.env` | Add `PAPER_*` env vars |
| Modify | `src/index.js` | Wire up trader + display |

---

## Task 1: Add paper config

**Files:**
- Modify: `src/config.js`
- Modify: `.env`

- [ ] **Step 1.1: Add paper block to `src/config.js`**

Open `src/config.js`. After the `chainlink` block, add:

```js
  paper: {
    enabled: (process.env.PAPER_ENABLED || "false").toLowerCase() === "true",
    startingBalance: Number(process.env.PAPER_STARTING_BALANCE || "1000"),
    betPct: Number(process.env.PAPER_BET_PCT || "5")
  }
```

Full file after change:

```js
export const CONFIG = {
  symbol: "BTCUSDT",
  binanceBaseUrl: "https://api.binance.com",
  gammaBaseUrl: "https://gamma-api.polymarket.com",
  clobBaseUrl: "https://clob.polymarket.com",

  pollIntervalMs: 1_000,
  candleWindowMinutes: 15,

  vwapSlopeLookbackMinutes: 5,
  rsiPeriod: 14,
  rsiMaPeriod: 14,

  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,

  polymarket: {
    marketSlug: process.env.POLYMARKET_SLUG || "",
    seriesId: process.env.POLYMARKET_SERIES_ID || "10192",
    seriesSlug: process.env.POLYMARKET_SERIES_SLUG || "btc-up-or-down-15m",
    autoSelectLatest: (process.env.POLYMARKET_AUTO_SELECT_LATEST || "true").toLowerCase() === "true",
    liveDataWsUrl: process.env.POLYMARKET_LIVE_WS_URL || "wss://ws-live-data.polymarket.com",
    upOutcomeLabel: process.env.POLYMARKET_UP_LABEL || "Up",
    downOutcomeLabel: process.env.POLYMARKET_DOWN_LABEL || "Down"
  },

  chainlink: {
    polygonRpcUrls: (process.env.POLYGON_RPC_URLS || "").split(",").map((s) => s.trim()).filter(Boolean),
    polygonRpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    polygonWssUrls: (process.env.POLYGON_WSS_URLS || "").split(",").map((s) => s.trim()).filter(Boolean),
    polygonWssUrl: process.env.POLYGON_WSS_URL || "",
    btcUsdAggregator: process.env.CHAINLINK_BTC_USD_AGGREGATOR || "0xc907E116054Ad103354f2D350FD2514433D57F6f"
  },

  paper: {
    enabled: (process.env.PAPER_ENABLED || "false").toLowerCase() === "true",
    startingBalance: Number(process.env.PAPER_STARTING_BALANCE || "1000"),
    betPct: Number(process.env.PAPER_BET_PCT || "5")
  }
};
```

- [ ] **Step 1.2: Add paper vars to `.env`**

Append to the end of `.env`:

```
# Paper trading
PAPER_ENABLED=true
PAPER_STARTING_BALANCE=1000
PAPER_BET_PCT=5
```

- [ ] **Step 1.3: Verify config loads**

```bash
node -e "import('./src/config.js').then(m => console.log(JSON.stringify(m.CONFIG.paper, null, 2)))"
```

Expected output (with `.env` sourced):
```json
{
  "enabled": true,
  "startingBalance": 1000,
  "betPct": 5
}
```

---

## Task 2: Write failing tests for trader logic

**Files:**
- Create: `src/paper/trader.test.js`

- [ ] **Step 2.1: Add test script to `package.json`**

Add `"test": "node --test src/paper/trader.test.js"` to the `scripts` block:

```json
{
  "name": "polyassistent",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test src/paper/trader.test.js"
  },
  "dependencies": {
    "ethers": "^6.11.1",
    "https-proxy-agent": "^7.0.6",
    "socks-proxy-agent": "^8.0.5",
    "undici": "^6.21.3",
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2.2: Create `src/paper/trader.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEntry, computeSettlement } from "./trader.js";

// --- computeEntry ---

test("computeEntry: opens a trade on ENTER signal", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "ENTER",
    side: "UP",
    marketSlug: "btc-updown-15m-abc",
    priceToBeat: 96000,
    upPrice: 0.55,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade.side, "UP");
  assert.equal(result.openTrade.marketSlug, "btc-updown-15m-abc");
  assert.equal(result.openTrade.entryPrice, 0.55);
  assert.equal(result.openTrade.betAmount, 50); // floor(1000 * 5 / 100 * 100) / 100
  assert.ok(result.openTrade.shares > 0);
  assert.equal(result.balance, 1000); // balance unchanged until settlement
});

test("computeEntry: does not open a second trade in same market", () => {
  const existingTrade = {
    side: "UP", entryPrice: 0.55, betAmount: 50, shares: 90.9,
    marketSlug: "btc-updown-15m-abc", priceToBeat: 96000,
    openedAt: "2026-05-02T10:00:00.000Z"
  };
  const state = { balance: 1000, startingBalance: 1000, openTrade: existingTrade, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "ENTER",
    side: "DOWN",
    marketSlug: "btc-updown-15m-abc",
    priceToBeat: 96000,
    upPrice: 0.55,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade.side, "UP"); // unchanged
});

test("computeEntry: does not open trade on NO_TRADE signal", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "NO_TRADE",
    side: null,
    marketSlug: "btc-updown-15m-abc",
    priceToBeat: 96000,
    upPrice: 0.55,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade, null);
});

test("computeEntry: does not open trade when priceToBeat is null", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "ENTER",
    side: "UP",
    marketSlug: "btc-updown-15m-abc",
    priceToBeat: null,
    upPrice: 0.55,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade, null);
});

test("computeEntry: does not open trade when entryPrice is null", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "ENTER",
    side: "UP",
    marketSlug: "btc-updown-15m-abc",
    priceToBeat: 96000,
    upPrice: null,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade, null);
});

test("computeEntry: does not open trade when balance is zero", () => {
  const state = { balance: 0, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "ENTER",
    side: "UP",
    marketSlug: "btc-updown-15m-abc",
    priceToBeat: 96000,
    upPrice: 0.55,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade, null);
});

test("computeEntry: does not open trade when marketSlug is empty", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeEntry({
    state,
    signal: "ENTER",
    side: "UP",
    marketSlug: "",
    priceToBeat: 96000,
    upPrice: 0.55,
    downPrice: 0.45,
    betPct: 5
  });
  assert.equal(result.openTrade, null);
});

// --- computeSettlement ---

test("computeSettlement: UP WIN when settlementPrice > priceToBeat", () => {
  const openTrade = {
    side: "UP", entryPrice: 0.55, betAmount: 50, shares: 90.91,
    marketSlug: "btc-updown-15m-abc", priceToBeat: 96000,
    openedAt: "2026-05-02T10:00:00.000Z"
  };
  const state = { balance: 1000, startingBalance: 1000, openTrade, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: 96100 });
  assert.equal(result.lastTrade.outcome, "WIN");
  assert.ok(result.lastTrade.pnl > 0);
  assert.ok(result.balance > 1000);
  assert.equal(result.openTrade, null);
});

test("computeSettlement: UP LOSE when settlementPrice <= priceToBeat", () => {
  const openTrade = {
    side: "UP", entryPrice: 0.55, betAmount: 50, shares: 90.91,
    marketSlug: "btc-updown-15m-abc", priceToBeat: 96000,
    openedAt: "2026-05-02T10:00:00.000Z"
  };
  const state = { balance: 1000, startingBalance: 1000, openTrade, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: 95900 });
  assert.equal(result.lastTrade.outcome, "LOSE");
  assert.equal(result.lastTrade.pnl, -50);
  assert.equal(result.balance, 950);
  assert.equal(result.openTrade, null);
});

test("computeSettlement: DOWN WIN when settlementPrice < priceToBeat", () => {
  const openTrade = {
    side: "DOWN", entryPrice: 0.45, betAmount: 50, shares: 111.11,
    marketSlug: "btc-updown-15m-abc", priceToBeat: 96000,
    openedAt: "2026-05-02T10:00:00.000Z"
  };
  const state = { balance: 1000, startingBalance: 1000, openTrade, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: 95900 });
  assert.equal(result.lastTrade.outcome, "WIN");
  assert.ok(result.lastTrade.pnl > 0);
});

test("computeSettlement: DOWN LOSE when settlementPrice >= priceToBeat", () => {
  const openTrade = {
    side: "DOWN", entryPrice: 0.45, betAmount: 50, shares: 111.11,
    marketSlug: "btc-updown-15m-abc", priceToBeat: 96000,
    openedAt: "2026-05-02T10:00:00.000Z"
  };
  const state = { balance: 1000, startingBalance: 1000, openTrade, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: 96100 });
  assert.equal(result.lastTrade.outcome, "LOSE");
  assert.equal(result.lastTrade.pnl, -50);
});

test("computeSettlement: skips when settlementPrice is null", () => {
  const openTrade = {
    side: "UP", entryPrice: 0.55, betAmount: 50, shares: 90.91,
    marketSlug: "btc-updown-15m-abc", priceToBeat: 96000,
    openedAt: "2026-05-02T10:00:00.000Z"
  };
  const state = { balance: 1000, startingBalance: 1000, openTrade, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: null });
  assert.equal(result.openTrade, openTrade); // unchanged
  assert.equal(result.balance, 1000); // unchanged
});

test("computeSettlement: returns state unchanged when no open trade", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: 96100 });
  assert.equal(result.openTrade, null);
  assert.equal(result.balance, 1000);
});
```

- [ ] **Step 2.3: Run tests — expect failures**

```bash
npm test
```

Expected: errors like `SyntaxError` or `Error [ERR_MODULE_NOT_FOUND]` because `trader.js` doesn't exist yet.

---

## Task 3: Implement `src/paper/trader.js`

**Files:**
- Create: `src/paper/trader.js`

- [ ] **Step 3.1: Create `src/paper/trader.js`**

```js
import fs from "node:fs";
import path from "node:path";
import { appendCsvRow } from "../utils.js";

const STATE_FILE = "./logs/paper_state.json";
const TRADES_CSV = "./logs/paper_trades.csv";
const CSV_HEADER = [
  "closed_at", "market_slug", "side", "entry_price", "bet_amount",
  "shares", "price_to_beat", "btc_at_settlement", "outcome", "pnl", "balance_after"
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeEntry({ state, signal, side, marketSlug, priceToBeat, upPrice, downPrice, betPct }) {
  if (!marketSlug) return state;
  if (state.openTrade) return state;
  if (signal !== "ENTER" || !side) return state;
  if (!priceToBeat || !Number.isFinite(priceToBeat)) return state;

  const entryPrice = side === "UP" ? upPrice : downPrice;
  if (!entryPrice || !Number.isFinite(entryPrice)) return state;
  if (state.balance <= 0) return state;

  const betAmount = Math.floor(state.balance * betPct / 100 * 100) / 100;
  const shares = betAmount / entryPrice;

  return {
    ...state,
    openTrade: {
      side,
      entryPrice,
      betAmount,
      shares,
      marketSlug,
      priceToBeat,
      openedAt: new Date().toISOString()
    }
  };
}

export function computeSettlement({ state, settlementPrice }) {
  if (!state.openTrade) return state;
  if (settlementPrice === null || settlementPrice === undefined || !Number.isFinite(settlementPrice)) return state;

  const { side, shares, betAmount, priceToBeat } = state.openTrade;
  const win = side === "UP" ? settlementPrice > priceToBeat : settlementPrice < priceToBeat;
  const pnl = win ? round2(shares * 1.0 - betAmount) : -betAmount;
  const newBalance = round2(state.balance + pnl);

  const closedTrade = {
    ...state.openTrade,
    outcome: win ? "WIN" : "LOSE",
    pnl,
    btcAtSettlement: settlementPrice,
    closedAt: new Date().toISOString()
  };

  return {
    ...state,
    balance: newBalance,
    openTrade: null,
    lastTrade: closedTrade
  };
}

export function createPaperTrader({ startingBalance, betPct }) {
  let state = readState(startingBalance);

  function readState(startingBalance) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    } catch {
      return { balance: startingBalance, startingBalance, openTrade: null, lastTrade: null };
    }
  }

  function saveState() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  }

  function onSignal({ signal, side, marketSlug, priceToBeat, upPrice, downPrice, currentPrice }) {
    if (!marketSlug) return;

    if (state.openTrade && state.openTrade.marketSlug !== marketSlug) {
      const prev = state;
      state = computeSettlement({ state, settlementPrice: currentPrice });
      if (state !== prev && state.lastTrade) {
        const t = state.lastTrade;
        appendCsvRow(TRADES_CSV, CSV_HEADER, [
          t.closedAt, t.marketSlug, t.side, t.entryPrice,
          t.betAmount, round2(t.shares), t.priceToBeat,
          t.btcAtSettlement, t.outcome, t.pnl, state.balance
        ]);
        saveState();
      }
    }

    const next = computeEntry({ state, signal, side, marketSlug, priceToBeat, upPrice, downPrice, betPct });
    if (next !== state) {
      state = next;
      saveState();
    }
  }

  function getState() {
    return state;
  }

  return { onSignal, getState };
}
```

- [ ] **Step 3.2: Run tests — expect all to pass**

```bash
npm test
```

Expected output:
```
▶ src/paper/trader.test.js
  ✔ computeEntry: opens a trade on ENTER signal
  ✔ computeEntry: does not open a second trade in same market
  ✔ computeEntry: does not open trade on NO_TRADE signal
  ✔ computeEntry: does not open trade when priceToBeat is null
  ✔ computeEntry: does not open trade when entryPrice is null
  ✔ computeEntry: does not open trade when balance is zero
  ✔ computeEntry: does not open trade when marketSlug is empty
  ✔ computeSettlement: UP WIN when settlementPrice > priceToBeat
  ✔ computeSettlement: UP LOSE when settlementPrice <= priceToBeat
  ✔ computeSettlement: DOWN WIN when settlementPrice < priceToBeat
  ✔ computeSettlement: DOWN LOSE when settlementPrice >= priceToBeat
  ✔ computeSettlement: skips when settlementPrice is null
  ✔ computeSettlement: returns state unchanged when no open trade
ℹ tests 13
ℹ pass 13
ℹ fail 0
```

If any tests fail, fix `trader.js` until all 13 pass before continuing.

---

## Task 4: Implement `src/paper/display.js`

**Files:**
- Create: `src/paper/display.js`

- [ ] **Step 4.1: Create `src/paper/display.js`**

```js
import { formatNumber } from "../utils.js";

export function renderPaperSection(state, { ANSI, kv, sepLine }) {
  const { balance, startingBalance, openTrade, lastTrade } = state;
  const pnlTotal = balance - startingBalance;
  const pnlPct = startingBalance > 0 ? (pnlTotal / startingBalance) * 100 : 0;
  const balanceColor = pnlTotal >= 0 ? ANSI.green : ANSI.red;
  const sign = pnlTotal >= 0 ? "+" : "";
  const balanceLine = kv("Balance:", `${balanceColor}$${formatNumber(balance, 2)}  (${sign}${pnlPct.toFixed(2)}%)${ANSI.reset}`);

  let openLine;
  if (balance <= 0) {
    openLine = kv("Status:", `${ANSI.red}BANKRUPT${ANSI.reset}`);
  } else if (openTrade) {
    const priceStr = `${(openTrade.entryPrice * 100).toFixed(0)}¢`;
    const sideColor = openTrade.side === "UP" ? ANSI.green : ANSI.red;
    openLine = kv("Open trade:", `${sideColor}BUY ${openTrade.side}${ANSI.reset} @ ${priceStr} | $${formatNumber(openTrade.betAmount, 2)} | ${formatNumber(openTrade.shares, 1)} shares`);
  } else {
    openLine = kv("Open trade:", `${ANSI.gray}—${ANSI.reset}`);
  }

  let lastLine;
  if (lastTrade) {
    const win = lastTrade.outcome === "WIN";
    const pnlSign = lastTrade.pnl >= 0 ? "+" : "";
    const color = win ? ANSI.green : ANSI.red;
    lastLine = kv("Last trade:", `${color}BUY ${lastTrade.side} ${win ? "✓ WIN" : "✗ LOSE"}  ${pnlSign}$${formatNumber(Math.abs(lastTrade.pnl), 2)}${ANSI.reset}`);
  } else {
    lastLine = kv("Last trade:", `${ANSI.gray}—${ANSI.reset}`);
  }

  return [sepLine(), "", "PAPER TRADING", balanceLine, openLine, lastLine, ""];
}
```

---

## Task 5: Wire up in `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 5.1: Add imports at the top of `src/index.js`**

After the existing import block (after the `import { applyGlobalProxyFromEnv }` line), add:

```js
import { createPaperTrader } from "./paper/trader.js";
import { renderPaperSection } from "./paper/display.js";
```

- [ ] **Step 5.2: Initialize the paper trader before the main loop**

In the `main()` function, after the three stream declarations (`binanceStream`, `polymarketLiveStream`, `chainlinkStream`), add:

```js
const paperTrader = CONFIG.paper.enabled
  ? createPaperTrader({ startingBalance: CONFIG.paper.startingBalance, betPct: CONFIG.paper.betPct })
  : null;
```

- [ ] **Step 5.3: Call `onSignal` in the main loop**

Inside the `try` block in the main loop, after the `rec` and `edge` variables are computed (after the `const rec = decide(...)` line), add:

```js
if (paperTrader) {
  paperTrader.onSignal({
    signal: rec.action,
    side: rec.side,
    marketSlug,
    priceToBeat: priceToBeatState.slug === marketSlug ? priceToBeatState.value : null,
    upPrice: marketUp,
    downPrice: marketDown,
    currentPrice
  });
}
```

- [ ] **Step 5.4: Inject paper section into the console render**

In the `lines` array definition, find the line:
```js
binanceSpotKvLine,
```

Insert the paper section just before that line:

```js
...(paperTrader ? renderPaperSection(paperTrader.getState(), { ANSI, kv, sepLine }) : []),
```

So the surrounding block looks like:

```js
        ...(paperTrader ? renderPaperSection(paperTrader.getState(), { ANSI, kv, sepLine }) : []),
        binanceSpotKvLine,
```

- [ ] **Step 5.5: Verify the bot starts without errors**

Make sure `.env` is sourced, then run:

```bash
export $(grep -v '^#' .env | xargs) && npm start
```

Expected: bot starts normally. If `PAPER_ENABLED=true`, a `PAPER TRADING` section appears in the console between the Polymarket block and the Binance block, showing:

```
──────────────────────────────────────────────
PAPER TRADING
Balance:     $1,000.00  (+0.00%)
Open trade:  —
Last trade:  —
```

If `PAPER_ENABLED=false` (or var not set), the section is absent and behavior is identical to before.

---

## Verification Checklist

After completing all tasks, confirm:

- [ ] `npm test` — 13 tests pass, 0 fail
- [ ] Bot starts with `PAPER_ENABLED=false` — no paper section, no errors
- [ ] Bot starts with `PAPER_ENABLED=true` — paper section visible, balance shows $1,000.00
- [ ] After first ENTER signal fires — open trade line updates with side, price, shares
- [ ] After market slug changes — last trade line shows WIN/LOSE and P&L, balance updates
- [ ] `./logs/paper_state.json` exists and contains current state
- [ ] `./logs/paper_trades.csv` exists and grows one row per settled trade
- [ ] Restart bot mid-trade — open trade is preserved from `paper_state.json`
- [ ] Balance goes to zero — "BANKRUPT" shown, no new trades open
