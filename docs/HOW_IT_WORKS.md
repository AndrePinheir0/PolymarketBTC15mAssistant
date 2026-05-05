# Como funciona o bot

## Visão geral

O bot corre num loop contínuo (a cada ~1 segundo) e apresenta um painel no terminal com análise técnica em tempo real do BTC, preços do mercado Polymarket e um sinal de trade (LONG/SHORT).

---

## Fontes de dados

| Fonte | O que fornece |
|---|---|
| **Binance WebSocket** | Preço spot BTC/USDT em tempo real |
| **Polymarket WebSocket** | Feed Chainlink BTC/USD (mesmo usado na UI do Polymarket) |
| **Chainlink on-chain (Polygon)** | Fallback se o WS do Polymarket falhar |
| **Polymarket REST API** | Mercado ativo, preços UP/DOWN, order book |
| **Binance REST API** | Candles 1m e 5m para indicadores |

---

## Pipeline por ciclo

```
Candles 1m/5m
     │
     ▼
Indicadores ──── Heiken Ashi, RSI, MACD, VWAP
     │
     ▼
scoreDirection ── pontuação bruta UP/DOWN (0–1)
     │
     ▼
applyTimeAwareness ── ajusta probabilidade conforme tempo restante no mercado
     │
     ▼
computeEdge ── compara modelo com preços do mercado (UP¢ / DOWN¢)
     │
     ▼
decide ── ENTER (UP/DOWN) ou NO_TRADE, com base no edge e fase (EARLY/MID/LATE)
```

### Fases de decisão

| Fase | Tempo restante | Edge mínimo | Prob mínima |
|---|---|---|---|
| EARLY | > 10 min | 5% | 55% |
| MID | 5–10 min | 10% | 60% |
| LATE | < 5 min | 20% | 65% |

---

## Liquidação dos mercados

Cada mercado dura 15 minutos. O **price to beat** é o preço Chainlink no momento de abertura do mercado.

- BTC fecha **acima** do price to beat → **UP ganha**
- BTC fecha **abaixo** do price to beat → **DOWN ganha**

---

## Paper Trading

Quando `PAPER_ENABLED=true`, o bot simula trades automaticamente:

1. **Entrada** — primeiro sinal `ENTER` do mercado atual abre um trade virtual (5% do saldo, configurável)
2. **Liquidação** — quando o mercado muda (novo slug detectado), o trade anterior é liquidado com o preço Chainlink nesse momento
3. **Persistência** — estado guardado em `./logs/paper_state.json`, histórico em `./logs/paper_trades.csv`

---

## Ficheiros principais

```
src/
├── index.js              loop principal + renderização
├── config.js             configuração via env vars
├── engines/
│   ├── probability.js    scoreDirection + applyTimeAwareness
│   ├── edge.js           computeEdge + decide
│   └── regime.js         detecção de regime de mercado
├── indicators/           RSI, MACD, VWAP, Heiken Ashi
├── data/                 Binance, Polymarket, Chainlink (REST + WS)
└── paper/
    ├── trader.js          lógica de paper trading
    └── display.js         secção do painel de paper trading
```


Parar o robot:
pkill -f "node src/index.js"; sleep 2; ps aux | grep "node src/index" | grep -v grep | wc -l

Reiniciar o robot:
