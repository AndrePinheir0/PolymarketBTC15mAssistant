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
    openLine = kv("Open trade:", `${sideColor}BUY ${openTrade.side}${ANSI.reset} @ ${priceStr} | $${formatNumber(openTrade.betAmount, 2)}`);
  } else {
    openLine = kv("Open trade:", `${ANSI.gray}—${ANSI.reset}`);
  }

  let lastLine;
  if (lastTrade) {
    const win = lastTrade.outcome === "WIN" || lastTrade.outcome === "TAKE_PROFIT";
    const pnlSign = lastTrade.pnl >= 0 ? "+" : "";
    const color = win ? ANSI.green : ANSI.red;
    const tag = lastTrade.outcome === "TAKE_PROFIT" ? "✓ TP" : win ? "✓ WIN" : "✗ LOSE";
    lastLine = kv("Last trade:", `${color}BUY ${lastTrade.side} ${tag}  ${pnlSign}$${formatNumber(Math.abs(lastTrade.pnl), 2)}${ANSI.reset}`);
  } else {
    lastLine = kv("Last trade:", `${ANSI.gray}—${ANSI.reset}`);
  }

  return [sepLine(), "", "PAPER TRADING", balanceLine, openLine, lastLine, ""];
}
