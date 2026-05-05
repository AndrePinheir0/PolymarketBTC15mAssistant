import fs from "node:fs";
import path from "node:path";
import { appendCsvRow } from "../utils.js";

const STATE_FILE = "./logs/paper_state.json";
const TRADES_CSV = "./logs/paper_trades.csv";
const TRADE_LOG = "./logs/paper_log.txt";
const CSV_HEADER = [
  "closed_at", "market_slug", "side", "entry_price", "bet_amount",
  "shares", "price_to_beat", "btc_at_settlement", "outcome", "pnl", "balance_after",
  "opened_at", "rsi", "rsi_slope", "macd", "heiken", "vwap_dist_pct",
  "model_up", "model_down", "edge_up", "edge_down", "phase", "strength", "time_left_min"
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function computeEntry({ state, signal, side, marketSlug, priceToBeat, upPrice, downPrice, betPct, minEntryPrice = 0, maxEntryPrice = 1, indicators = {} }) {
  if (!marketSlug) return state;
  if (state.openTrade) return state;
  if (signal !== "ENTER" || !side) return state;
  if (!priceToBeat || !Number.isFinite(priceToBeat)) return state;

  const entryPrice = side === "UP" ? upPrice : downPrice;
  if (!entryPrice || !Number.isFinite(entryPrice)) return state;
  if (entryPrice < minEntryPrice) return state;
  if (entryPrice > maxEntryPrice) return state;
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
      openedAt: new Date().toISOString(),
      indicators
    }
  };
}

export function computeSettlement({ state, settlementPrice }) {
  if (!state.openTrade) return state;
  if (settlementPrice === null || settlementPrice === undefined || !Number.isFinite(settlementPrice)) return state;

  const { side, shares, betAmount, priceToBeat } = state.openTrade;
  const win = side === "UP" ? settlementPrice > priceToBeat : settlementPrice < priceToBeat;
  const pnl = win ? round2(shares * 1.0 - betAmount) : round2(-betAmount);
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

export function computeTakeProfit({ state, upPrice, downPrice, takeProfitPct }) {
  if (!state.openTrade) return state;
  if (!takeProfitPct || takeProfitPct <= 0) return state;

  const { side, entryPrice, shares, betAmount } = state.openTrade;
  const currentPrice = side === "UP" ? upPrice : downPrice;
  if (!currentPrice || !Number.isFinite(currentPrice)) return state;

  const gainPct = (currentPrice - entryPrice) / entryPrice * 100;
  if (gainPct < takeProfitPct) return state;

  const pnl = round2(shares * currentPrice - betAmount);
  const newBalance = round2(state.balance + pnl);

  const closedTrade = {
    ...state.openTrade,
    outcome: "TAKE_PROFIT",
    pnl,
    exitPrice: currentPrice,
    closedAt: new Date().toISOString()
  };

  return {
    ...state,
    balance: newBalance,
    openTrade: null,
    lastTrade: closedTrade
  };
}

function closeAtPrice(state, exitPrice, outcome) {
  const { shares, betAmount } = state.openTrade;
  const pnl = round2(shares * exitPrice - betAmount);
  const newBalance = round2(state.balance + pnl);
  const closedTrade = {
    ...state.openTrade,
    outcome,
    pnl,
    exitPrice,
    closedAt: new Date().toISOString()
  };
  return {
    ...state,
    balance: newBalance,
    openTrade: null,
    lastTrade: closedTrade
  };
}

export function computeDefensiveExit({ state, upPrice, downPrice, edgeUp, edgeDown, edgeExitThreshold = -0.05 }) {
  if (!state.openTrade) return state;
  if (edgeUp === null || edgeDown === null) return state;
  if (edgeUp === undefined || edgeDown === undefined) return state;

  const { side } = state.openTrade;
  const ourEdge = side === "UP" ? edgeUp : edgeDown;
  if (ourEdge >= edgeExitThreshold) return state;

  const currentPrice = side === "UP" ? upPrice : downPrice;
  if (!currentPrice || !Number.isFinite(currentPrice)) return state;

  return closeAtPrice(state, currentPrice, "EDGE_EXIT");
}

export function computeStopLoss({ state, upPrice, downPrice, stopLossPct }) {
  if (!state.openTrade) return state;
  if (!stopLossPct || stopLossPct <= 0) return state;

  const { side, entryPrice } = state.openTrade;
  const currentPrice = side === "UP" ? upPrice : downPrice;
  if (!currentPrice || !Number.isFinite(currentPrice)) return state;

  const lossPct = (entryPrice - currentPrice) / entryPrice * 100;
  if (lossPct < stopLossPct) return state;

  return closeAtPrice(state, currentPrice, "STOP_LOSE");
}

export function computeFlip({ state, signal, side, marketSlug, upPrice, downPrice, modelUp, modelDown, edgeUp, edgeDown, flipMinProb = 0.75, flipMinEdge = 0.20 }) {
  if (!state.openTrade) return state;
  if (state.openTrade.marketSlug !== marketSlug) return state;
  if (signal !== "ENTER" || !side) return state;
  if (side === state.openTrade.side) return state;

  const oppProb = side === "UP" ? modelUp : modelDown;
  const oppEdge = side === "UP" ? edgeUp : edgeDown;
  if (oppProb === null || oppProb === undefined) return state;
  if (oppEdge === null || oppEdge === undefined) return state;
  if (oppProb < flipMinProb || oppEdge < flipMinEdge) return state;

  const exitPrice = state.openTrade.side === "UP" ? upPrice : downPrice;
  if (!exitPrice || !Number.isFinite(exitPrice)) return state;

  const flipped = closeAtPrice(state, exitPrice, "FLIP_EXIT");
  return { ...flipped, _flipPending: { side, marketSlug } };
}

export function createPaperTrader({ startingBalance, betPct, minEntryPrice = 0, maxEntryPrice = 1, takeProfitPct = 0, stopLossPct = 0, edgeExitThreshold = null, flipMinProb = 0.75, flipMinEdge = 0.20 }) {
  function readState(sb) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    } catch {
      return { balance: sb, startingBalance: sb, openTrade: null, lastTrade: null };
    }
  }

  let state = readState(startingBalance);

  function saveState() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  }

  function writeLog(line) {
    fs.mkdirSync(path.dirname(TRADE_LOG), { recursive: true });
    fs.appendFileSync(TRADE_LOG, line + "\n", "utf8");
  }

  function logClosedTrade(t) {
    const ind = t.indicators ?? {};
    const rsiArrow = ind.rsiSlope > 0 ? "↑" : ind.rsiSlope < 0 ? "↓" : "-";
    const pnlSign = t.pnl >= 0 ? "+" : "";
    writeLog([
      t.closedAt, `[${t.outcome}]`, `BUY ${t.side}`,
      `${pnlSign}$${Math.abs(t.pnl).toFixed(2)}`,
      `balance $${state.balance.toFixed(2)}`,
      `| RSI ${ind.rsi != null ? ind.rsi.toFixed(1) : "-"}${rsiArrow}`,
      `MACD ${ind.macd ?? "-"}`, `HA ${ind.heiken ?? "-"}`,
      `VWAP ${ind.vwapDistPct != null ? (ind.vwapDistPct * 100).toFixed(2) + "%" : "-"}`,
      `modelUp ${ind.modelUp != null ? (ind.modelUp * 100).toFixed(0) + "%" : "-"}`,
      `edgeUp ${ind.edgeUp != null ? (ind.edgeUp * 100).toFixed(1) + "%" : "-"}`,
      `${ind.phase ?? "-"}`, `${ind.strength ?? "-"}`,
      `${ind.timeLeftMin != null ? ind.timeLeftMin.toFixed(1) + "min" : "-"}`
    ].join(" "));
    appendCsvRow(TRADES_CSV, CSV_HEADER, [
      t.closedAt, t.marketSlug, t.side, t.entryPrice,
      t.betAmount, round2(t.shares), t.priceToBeat,
      t.btcAtSettlement, t.outcome, t.pnl, state.balance,
      t.openedAt, ind.rsi, ind.rsiSlope, ind.macd, ind.heiken,
      ind.vwapDistPct, ind.modelUp, ind.modelDown,
      ind.edgeUp, ind.edgeDown, ind.phase, ind.strength, ind.timeLeftMin
    ]);
  }

  function tryClose(nextState) {
    if (nextState !== state && nextState.lastTrade) {
      state = nextState;
      logClosedTrade(state.lastTrade);
      saveState();
      return true;
    }
    return false;
  }

  function onSignal({ signal, side, marketSlug, priceToBeat, upPrice, downPrice, currentPrice, indicators = {} }) {
    if (!marketSlug) return;

    if (state.openTrade && state.openTrade.marketSlug === marketSlug) {
      if (tryClose(computeTakeProfit({ state, upPrice, downPrice, takeProfitPct }))) return;

      if (stopLossPct > 0 && tryClose(computeStopLoss({ state, upPrice, downPrice, stopLossPct }))) return;

      const edgeUp = indicators.edgeUp ?? null;
      const edgeDown = indicators.edgeDown ?? null;
      const modelUp = indicators.modelUp ?? null;
      const modelDown = indicators.modelDown ?? null;

      if (signal === "ENTER" && side && side !== state.openTrade.side) {
        const flipped = computeFlip({
          state, signal, side, marketSlug, upPrice, downPrice,
          modelUp, modelDown, edgeUp, edgeDown, flipMinProb, flipMinEdge
        });
        if (flipped !== state && flipped.lastTrade) {
          const pending = flipped._flipPending;
          state = { ...flipped };
          delete state._flipPending;
          logClosedTrade(state.lastTrade);
          saveState();
          if (pending) {
            const reopened = computeEntry({
              state, signal: "ENTER", side: pending.side, marketSlug,
              priceToBeat, upPrice, downPrice, betPct, minEntryPrice, maxEntryPrice, indicators
            });
            if (reopened !== state) {
              state = reopened;
              saveState();
            }
          }
          return;
        }
      }

      if (edgeExitThreshold !== null && tryClose(computeDefensiveExit({ state, upPrice, downPrice, edgeUp, edgeDown, edgeExitThreshold }))) return;
    }

    if (state.openTrade && state.openTrade.marketSlug !== marketSlug) {
      tryClose(computeSettlement({ state, settlementPrice: currentPrice }));
    }

    const next = computeEntry({ state, signal, side, marketSlug, priceToBeat, upPrice, downPrice, betPct, minEntryPrice, maxEntryPrice, indicators });
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
