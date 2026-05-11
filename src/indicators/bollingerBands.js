import { sma } from "./rsi.js";

export function computeBollingerBands(closes, period = 20, stdDevMult = 2) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  const mid = sma(closes, period);
  if (mid === null) return null;
  const variance = slice.reduce((acc, v) => acc + (v - mid) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = mid + stdDevMult * stdDev;
  const lower = mid - stdDevMult * stdDev;
  const bandwidth = mid > 0 ? (upper - lower) / mid : null;
  const pctB = upper !== lower ? (closes[closes.length - 1] - lower) / (upper - lower) : null;
  return { upper, mid, lower, bandwidth, pctB, stdDev };
}

// ATR over `period` candles using high/low/close
export function computeAtr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const slice = candles.slice(candles.length - period - 1);
  let atrSum = 0;
  for (let i = 1; i <= period; i++) {
    const high = slice[i].high ?? slice[i].close;
    const low  = slice[i].low  ?? slice[i].close;
    const prevClose = slice[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atrSum += tr;
  }
  return atrSum / period;
}

// Order book imbalance for a single side's book summary.
// Returns a value in [-1, 1]: positive = bid pressure (buyers dominating).
export function computeObImbalance(bidLiquidity, askLiquidity) {
  if (bidLiquidity == null || askLiquidity == null) return null;
  const total = bidLiquidity + askLiquidity;
  if (total === 0) return null;
  return (bidLiquidity - askLiquidity) / total;
}
