# Paper Trading — Design Spec
**Date:** 2026-05-02

## Overview

Add a paper trading layer to the PolymarketBTC15mAssistant that simulates trades based on the bot's existing signals, tracks a virtual balance, and displays trade activity in the console. No real money is ever used.

---

## Configuration

Three new environment variables (added to `.env`):

| Variable | Default | Description |
|---|---|---|
| `PAPER_ENABLED` | `false` | Set to `true` to activate paper trading |
| `PAPER_STARTING_BALANCE` | `1000` | Initial virtual balance in USD |
| `PAPER_BET_PCT` | `5` | Percentage of current balance to bet per trade (e.g. 5 = 5%) |

When `PAPER_ENABLED=false` (the default), the feature is completely inactive and nothing changes in existing behavior.

---

## New Files

### `src/paper/trader.js`
Core logic module. Exports a `PaperTrader` class (or factory) with:
- `loadState()` — reads `./logs/paper_state.json` on startup; initializes fresh state if missing
- `onSignal({ signal, side, marketSlug, priceToBeat, upPrice, downPrice, currentPrice })` — called each poll cycle with the current market data and signal
- `saveState()` — writes current balance and open trade to `./logs/paper_state.json`

### `src/paper/display.js`
Formatting utilities. Exports:
- `renderPaperSection(state)` — returns a formatted string block for inclusion in the console screen

---

## Data Files (in `./logs/`)

### `paper_state.json`
Persists across restarts. Contains:
```json
{
  "balance": 1024.50,
  "startingBalance": 1000,
  "openTrade": {
    "side": "UP",
    "entryPrice": 0.55,
    "betAmount": 51.22,
    "shares": 93.13,
    "marketSlug": "btc-updown-15m-...",
    "priceToBeat": 96200.00,
    "openedAt": "2026-05-02T10:00:01.000Z"
  },
  "lastTrade": {
    "side": "DOWN",
    "entryPrice": 0.48,
    "betAmount": 50.00,
    "shares": 104.17,
    "priceToBeat": 96150.00,
    "outcome": "WIN",
    "pnl": 52.08,
    "closedAt": "2026-05-02T09:45:00.000Z"
  }
}
```
`openTrade` is `null` when no trade is active.

### `paper_trades.csv`
Append-only log of every settled trade. Columns:
```
closed_at, market_slug, side, entry_price, bet_amount, shares, price_to_beat, btc_at_settlement, outcome, pnl, balance_after
```

---

## Trade Lifecycle

### 1. Entry
- Triggered by the first `ENTER` signal in a new market window (identified by `marketSlug`)
- One trade per market slug — once an entry is recorded for the current slug, subsequent `ENTER` signals in the same window are ignored
- Bet amount = `floor(balance * PAPER_BET_PCT / 100 * 100) / 100` (rounded to cents)
- Shares = `betAmount / entryPrice` (entryPrice is `upPrice` if side=UP, `downPrice` if side=DOWN)
- State is saved immediately after entry

### 2. Settlement
- Triggered when `marketSlug` changes (a new 15m market has opened), indicating the previous market has settled
- Settlement price used = `currentPrice` (live Chainlink BTC/USD) at the moment the new slug is detected
- Outcome logic:
  - `side=UP` and `settlementPrice > priceToBeat` → **WIN**: `payout = shares * 1.0`, `pnl = payout - betAmount`
  - `side=UP` and `settlementPrice <= priceToBeat` → **LOSE**: `pnl = -betAmount`
  - `side=DOWN` and `settlementPrice < priceToBeat` → **WIN**
  - `side=DOWN` and `settlementPrice >= priceToBeat` → **LOSE**
- Balance updated: `balance += pnl`
- Trade appended to `paper_trades.csv`
- `openTrade` cleared, `lastTrade` updated
- State saved

### 3. No Signal
- If the poll cycle produces `NO_TRADE` and there is no open trade, nothing happens
- If there is an open trade, it remains open until the market slug changes

---

## Console Display

A new section is injected into the existing console screen render, between the Polymarket block and the Binance block:

```
──────────────────────────────────────────────
PAPER TRADING
Balance:     $1,024.50  (+2.45%)
Open trade:  BUY UP @ 55¢ | $51.22 | 93.1 shares
Last trade:  BUY DOWN ✓ WIN  +$23.45
──────────────────────────────────────────────
```

- Balance line shows current balance and % change from starting balance (green if positive, red if negative)
- Open trade line shows the current open position, or `—` if none
- Last trade line shows the most recent settled trade result, or `—` if none
- Section is only rendered when `PAPER_ENABLED=true`

---

## Integration in `src/index.js`

In the main loop, after the signal/edge computation:

```js
if (CONFIG.paper.enabled) {
  paperTrader.onSignal({
    signal: rec.action,         // "ENTER" or "NO_TRADE"
    side: rec.side,             // "UP" or "DOWN" or null
    marketSlug,
    priceToBeat,
    upPrice: marketUp,
    downPrice: marketDown,
    currentPrice
  });
}
```

The paper section is appended to the `lines` array before `renderScreen()`.

---

## Config additions in `src/config.js`

```js
paper: {
  enabled: (process.env.PAPER_ENABLED || "false").toLowerCase() === "true",
  startingBalance: Number(process.env.PAPER_STARTING_BALANCE || "1000"),
  betPct: Number(process.env.PAPER_BET_PCT || "5")
}
```

---

## Edge Cases

- **Bot restarts mid-trade** — `paper_state.json` preserves the open trade; settlement fires normally when the slug next changes
- **`currentPrice` is null at settlement** — skip settlement, keep trade open until price is available
- **`priceToBeat` is null** — do not open a new trade; log a warning to console
- **`upPrice` / `downPrice` is null** — do not open a new trade
- **Balance drops to zero or below** — stop opening new trades; display "BANKRUPT" in the paper section
- **`marketSlug` is empty string** — treat as "no market loaded yet"; do not open or settle trades
