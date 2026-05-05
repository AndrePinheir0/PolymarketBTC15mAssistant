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
  assert.equal(result.openTrade.betAmount, 50);
  assert.ok(result.openTrade.shares > 0);
  assert.equal(result.balance, 1000);
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
  assert.equal(result.openTrade.side, "UP");
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
  assert.equal(result.openTrade, openTrade);
  assert.equal(result.balance, 1000);
});

test("computeSettlement: returns state unchanged when no open trade", () => {
  const state = { balance: 1000, startingBalance: 1000, openTrade: null, lastTrade: null };
  const result = computeSettlement({ state, settlementPrice: 96100 });
  assert.equal(result.openTrade, null);
  assert.equal(result.balance, 1000);
});

