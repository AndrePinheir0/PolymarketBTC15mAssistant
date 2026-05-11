import { clamp } from "../utils.js";

export function scoreDirection(inputs) {
  const {
    price,
    vwap,
    vwapSlope,
    rsi,
    rsiSlope,
    heikenColor,
    heikenCount,
    failedVwapReclaim,
    bb,
    atrPct,
    obImbalanceUp,
    obImbalanceDown
  } = inputs;

  let up = 1;
  let down = 1;

  if (price !== null && vwap !== null) {
    if (price > vwap) up += 2;
    if (price < vwap) down += 2;
  }

  if (vwapSlope !== null) {
    if (vwapSlope > 0) up += 2;
    if (vwapSlope < 0) down += 2;
  }

  if (rsi !== null && rsiSlope !== null) {
    if (rsi > 55 && rsiSlope > 0) up += 2;
    if (rsi < 45 && rsiSlope < 0) down += 2;
  }

  if (heikenColor) {
    if (heikenColor === "green" && heikenCount >= 2) up += 1;
    if (heikenColor === "red" && heikenCount >= 2) down += 1;
  }

  if (failedVwapReclaim === true) down += 3;

  // Bollinger Bands: price near upper band → bullish momentum; near lower → bearish.
  // Squeeze (narrow bandwidth) → reduce conviction on both sides.
  if (bb !== null && bb !== undefined) {
    if (bb.pctB !== null) {
      if (bb.pctB > 0.8) up += 2;
      else if (bb.pctB < 0.2) down += 2;
    }
    // Squeeze: bandwidth < 0.5% of price → choppy, penalise both
    if (bb.bandwidth !== null && bb.bandwidth < 0.005) {
      up -= 1;
      down -= 1;
    }
  }

  // ATR filter: very low volatility (< 0.05% of price) → market too flat, reduce confidence
  if (atrPct !== null && atrPct !== undefined && atrPct < 0.0005) {
    up -= 1;
    down -= 1;
  }

  // Order book imbalance: bid > ask on UP token → buyers dominating → bullish signal
  if (obImbalanceUp !== null && obImbalanceUp !== undefined) {
    if (obImbalanceUp > 0.2) up += 2;
    else if (obImbalanceUp < -0.2) down += 1;
  }
  if (obImbalanceDown !== null && obImbalanceDown !== undefined) {
    if (obImbalanceDown > 0.2) down += 2;
    else if (obImbalanceDown < -0.2) up += 1;
  }

  up = Math.max(0, up);
  down = Math.max(0, down);
  const rawUp = (up + down) === 0 ? 0.5 : up / (up + down);
  return { upScore: up, downScore: down, rawUp };
}

export function applyTimeAwareness(rawUp, remainingMinutes, windowMinutes) {
  const timeDecay = clamp(remainingMinutes / windowMinutes, 0, 1);
  const adjustedUp = clamp(0.5 + (rawUp - 0.5) * timeDecay, 0, 1);
  return { timeDecay, adjustedUp, adjustedDown: 1 - adjustedUp };
}
