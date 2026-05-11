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
    betPct: Number(process.env.PAPER_BET_PCT || "5"),
    minEntryPrice: Number(process.env.PAPER_MIN_ENTRY_PRICE || "0.50"),
    maxEntryPrice: Number(process.env.PAPER_MAX_ENTRY_PRICE || "0.65"),
    takeProfitPct: Number(process.env.PAPER_TAKE_PROFIT_PCT || "20"),
    tpEarlyMinutes: Number(process.env.PAPER_TP_EARLY_MINUTES || "10"),
    tpLateMinutes: Number(process.env.PAPER_TP_LATE_MINUTES || "5"),
    tpEarlyMultiplier: Number(process.env.PAPER_TP_EARLY_MULTIPLIER || "1.5"),
    tpLateMultiplier: Number(process.env.PAPER_TP_LATE_MULTIPLIER || "0.6"),
    tpEdgeStrongThreshold: Number(process.env.PAPER_TP_EDGE_STRONG_THRESHOLD || "0.30"),
    tpEdgeStrongBonus: Number(process.env.PAPER_TP_EDGE_STRONG_BONUS || "0.30"),
    stopLossPct: Number(process.env.PAPER_STOP_LOSS_PCT || "25"),
    stopLossEarlyMinutes: Number(process.env.PAPER_STOP_LOSS_EARLY_MINUTES || "10"),
    catastrophicLossPct: Number(process.env.PAPER_CATASTROPHIC_LOSS_PCT || "50"),
    edgeExitThreshold: process.env.PAPER_EDGE_EXIT_THRESHOLD === undefined
      ? -0.02
      : Number(process.env.PAPER_EDGE_EXIT_THRESHOLD),
    edgeExitEarlyThreshold: process.env.PAPER_EDGE_EXIT_EARLY_THRESHOLD === undefined
      ? -0.15
      : Number(process.env.PAPER_EDGE_EXIT_EARLY_THRESHOLD),
    earlyMinutes: Number(process.env.PAPER_EARLY_MINUTES || "10"),
    flipMinProb: Number(process.env.PAPER_FLIP_MIN_PROB || "0.75"),
    flipMinEdge: Number(process.env.PAPER_FLIP_MIN_EDGE || "0.20")
  },

  dashboard: {
    user: process.env.DASHBOARD_USER || "admin",
    password: process.env.DASHBOARD_PASSWORD || "",
    port: Number(process.env.DASHBOARD_PORT || "3000")
  }
};
