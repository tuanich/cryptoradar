// pages/api/recommendation.js
// All data from Yahoo Finance (Binance is geo-blocked on Vercel).
// Real per-asset ETF flow snapshot (Farside, 12 Jun 2026).
// 4h candles are RESAMPLED from 1h so 4h != 1h.

const { getSummary } = require('../../lib/etfFlows');
const e = await getSummary(coin.label);   // handler is already async, so await is fine

rec.etf = {
  hasEtf:  e.hasEtf,
  last1d:  e.latest,
  net10d:  e.tenDay,
  funds:   e.funds,
  lastDate: e.lastDate,        // <-- new: drives the dynamic date label
  signal:  /* keep your existing signal logic (uses e.tenDay / net10d) */,
};

const cache = new Map();
const TTL = 90000;

// ---- real ETF flow snapshot (US$m), Farside, through 12 Jun 2026 ----
const ETF = {
  BTC: { last1d: 85.9,  net10d: -2041.3, hasEtf: true,  funds: 'IBIT, FBTC, BITB, ARKB, GBTC' },
  ETH: { last1d: -4.9,  net10d: -189.2,  hasEtf: true,  funds: 'ETHA, FETH, ETHE' },
  SOL: { last1d: 0.0,   net10d: -10.4,   hasEtf: true,  funds: 'BSOL, FSOL, GSOL' },
  BNB: { last1d: 0,     net10d: 0,       hasEtf: false, funds: 'no US spot ETF yet' },
};
function etfSignalFrom(net10d, hasEtf) {
  if (!hasEtf) return 'NEUTRAL';
  if (net10d > 500) return 'STRONG BUY';
  if (net10d > 100) return 'BUY';
  if (net10d < -500) return 'STRONG SELL';
  if (net10d < -100) return 'SELL';
  return 'NEUTRAL';
}

function ema(a, n) { const k = 2 / (n + 1); let e = a[0]; for (let i = 1; i < a.length; i++) e = a[i] * k + e * (1 - k); return e; }

function analyze(closes, vols) {
  if (!closes || closes.length < 52) return null;
  if (!vols || !vols.length) vols = new Array(closes.length).fill(1);
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const md = ((ma20 - ma50) / ma50) * 100;
  const maSig = md > 1 ? 'STRONG BUY' : md > 0.1 ? 'BUY' : md < -1 ? 'STRONG SELL' : md < -0.1 ? 'SELL' : 'NEUTRAL';
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; d > 0 ? g += d : l += Math.abs(d); }
  const rsi = 100 - (100 / (1 + (g / 14) / ((l / 14) || 0.001)));
  const rsiSig = rsi < 25 ? 'STRONG BUY' : rsi < 35 ? 'BUY' : rsi > 75 ? 'STRONG SELL' : rsi > 65 ? 'SELL' : 'NEUTRAL';
  const macdSig = (ema(closes, 12) - ema(closes, 26)) > 0 ? 'BUY' : 'SELL';
  const hi = Math.max(...closes.slice(-20)), lo = Math.min(...closes.slice(-20));
  const pos = (closes[closes.length - 1] - lo) / ((hi - lo) || 1);
  const srSig = pos < 0.25 ? 'BUY' : pos > 0.75 ? 'SELL' : 'NEUTRAL';
  const avgV = (vols.slice(-20, -1).reduce((a, b) => a + b, 0) / 19) || 1;
  const chg = closes[closes.length - 1] - closes[closes.length - 2];
  const vr = (vols[vols.length - 1] || 1) / avgV;
  const volSig = vr > 1.5 && chg > 0 ? 'BUY' : vr > 1.5 && chg < 0 ? 'SELL' : 'NEUTRAL';
  const M = { 'STRONG BUY': 2, 'BUY': 1, 'NEUTRAL': 0, 'SELL': -1, 'STRONG SELL': -2 };
  const score = M[maSig] + M[rsiSig] + M[macdSig] + M[srSig] + M[volSig];
  const overall = score >= 4 ? 'STRONG BUY' : score >= 2 ? 'BUY' : score <= -4 ? 'STRONG SELL' : score <= -2 ? 'SELL' : 'NEUTRAL';
  const atr = closes.slice(-14).reduce((s, c, i, a) => s + (i > 0 ? Math.abs(c - a[i - 1]) : 0), 0) / 13;
  return { overall, score, indicators: { maSig, rsiSig, macdSig, srSig, volSig }, rsi: parseFloat(rsi.toFixed(1)), atr, ma20, price: closes[closes.length - 1], support: lo, resistance: hi };
}

// resample 1h arrays into Nh blocks (close of each block, summed volume)
function resample(closes, vols, n) {
  const c = [], v = [];
  for (let i = 0; i < closes.length; i += n) {
    const blkC = closes.slice(i, i + n), blkV = vols.slice(i, i + n);
    if (!blkC.length) continue;
    c.push(blkC[blkC.length - 1]);
    v.push(blkV.reduce((a, b) => a + b, 0));
  }
  return { closes: c, vols: v };
}

async function fetchYahoo(sym, interval, range) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=' + interval + '&range=' + range;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('Yahoo ' + sym + ' ' + r.status);
  const d = await r.json();
  const q = d.chart.result[0];
  const closes = q.indicators.quote[0].close.filter(x => x != null);
  const vols = (q.indicators.quote[0].volume || []).map(x => x || 0);
  const price = q.meta.regularMarketPrice;
  const chgPct = ((price - q.meta.chartPreviousClose) / q.meta.chartPreviousClose) * 100;
  return { closes, vols, price, chgPct, analysis: analyze(closes, vols) };
}

const COIN_MAP = { BTCUSDT: 'BTC-USD', ETHUSDT: 'ETH-USD', SOLUSDT: 'SOL-USD', BNBUSDT: 'BNB-USD' };

async function fetchCryptoTFs(coin) {
  const y = COIN_MAP[coin] || 'BTC-USD';
  const [w, d, h1raw] = await Promise.all([
    fetchYahoo(y, '1wk', '2y').catch(() => null),
    fetchYahoo(y, '1d', '1y').catch(() => null),
    fetchYahoo(y, '1h', '1mo').catch(() => null),
  ]);
  let h4 = null, h1 = null;
  if (h1raw) {
    h1 = h1raw;
    const r4 = resample(h1raw.closes, h1raw.vols, 4);
    h4 = { ...h1raw, analysis: analyze(r4.closes, r4.vols) };
  }
  return { '1w': w, '1d': d, '4h': h4, '1h': h1 };
}

const MACRO = { '^DJI': { w: 2, up: true }, '^IXIC': { w: 2, up: true }, 'GC=F': { w: 1, up: true }, 'CL=F': { w: -1, up: false }, 'DX-Y.NYB': { w: -2, up: false }, '^TNX': { w: -2, up: false } };
function calcMacro(md) {
  let score = 0, total = 0;
  Object.entries(md).forEach(([k, d]) => {
    const c = MACRO[k]; if (!d?.analysis || !c) return;
    const s = d.analysis.overall, bull = s === 'BUY' || s === 'STRONG BUY', bear = s === 'SELL' || s === 'STRONG SELL', w = Math.abs(c.w);
    c.up ? (bull ? score += w : bear ? score -= w : 0) : (bear ? score += w : bull ? score -= w : 0); total += w;
  });
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const trend = pct >= 40 ? 'BULL' : pct <= -40 ? 'BEAR' : pct >= 15 ? 'MILD BULL' : pct <= -15 ? 'MILD BEAR' : 'NEUTRAL';
  return { score, pct, trend };
}

function buildRec(macro, etfData, tfs, coin) {
  const w1 = tfs['1w']?.analysis, d1 = tfs['1d']?.analysis, h4 = tfs['4h']?.analysis, h1 = tfs['1h']?.analysis;
  const currentPrice = h1?.price || d1?.price || 0;
  const chgPct = h1?.chgPct || 0;
  const atr = h4?.atr || d1?.atr || 0;
  const bull = s => s === 'BUY' || s === 'STRONG BUY', bear = s => s === 'SELL' || s === 'STRONG SELL';
  const mb = macro.trend === 'BULL' || macro.trend === 'MILD BULL', mr = macro.trend === 'BEAR' || macro.trend === 'MILD BEAR';
  const eb = bull(etfData.signal), er = bear(etfData.signal);
  const tb = mb && bull(w1?.overall), tr = mr && bear(w1?.overall);

  let layers = 0;
  if (mb || mr) layers++;
  if (eb || er) layers++;
  if (tb || tr) layers++;
  if ((tb && bull(d1?.overall)) || (tr && bear(d1?.overall))) layers++;
  if ((tb && bull(h4?.overall)) || (tr && bear(h4?.overall))) layers++;
  const confidence = Math.round((layers / 5) * 100);

  // soft directional lean (always computed, even when no trade)
  const leanScore = (macro.pct / 100) + (etfData.net10d > 0 ? 0.5 : etfData.net10d < 0 ? -0.5 : 0) + (bull(w1?.overall) ? 0.5 : bear(w1?.overall) ? -0.5 : 0);
  const bias = leanScore > 0.4 ? 'Leaning bullish' : leanScore < -0.4 ? 'Leaning bearish' : 'Mixed / no clear lean';

  let action, short, entryPrice, entryNote, waitingFor, dp, wp;
  if (tb && eb && bull(h4?.overall) && bull(h1?.overall)) {
    action = 'BUY NOW'; short = 'BUY'; entryPrice = currentPrice;
    entryNote = 'Enter at market now — all layers aligned bullish.';
    waitingFor = ''; dp = 'Enter long now. Set stop below recent 4h support.'; wp = 'Hold 3-5 days toward weekly resistance.';
  } else if (tb && bull(h4?.overall)) {
    action = 'GET READY TO BUY'; short = 'WAIT_BUY'; entryPrice = currentPrice;
    entryNote = 'Buy when the 1h chart confirms (turns BUY). Entry ~ market.';
    waitingFor = '1h timeframe to flip to BUY'; dp = 'Wait for 1h BUY trigger, then enter.'; wp = 'Entry zone forming.';
  } else if (tb) {
    action = 'BUY THE DIP (wait for pullback)'; short = 'WAIT_BUY';
    entryPrice = d1?.support || currentPrice * 0.97;
    entryNote = 'Macro+weekly bullish but price extended. Buy near recent support, not at market.';
    waitingFor = 'price to pull back toward support ~' + (d1?.support ? Math.round(d1.support) : '');
    dp = 'Set a limit buy near support. Do not chase.'; wp = 'Accumulate on dips.';
  } else if (tr && er && bear(h4?.overall) && bear(h1?.overall)) {
    action = 'SELL / AVOID'; short = 'SELL'; entryPrice = currentPrice;
    entryNote = 'Exit longs / short at market — all layers aligned bearish.';
    waitingFor = ''; dp = 'Exit longs. Short on breakdown with tight stop.'; wp = 'Stay in cash.';
  } else if (tr && bear(h4?.overall)) {
    action = 'GET READY TO SELL'; short = 'WAIT_SELL'; entryPrice = currentPrice;
    entryNote = 'Sell/short when 1h confirms (turns SELL).';
    waitingFor = '1h timeframe to flip to SELL'; dp = 'Avoid new buys. Wait for 1h SELL.'; wp = 'Hold cash.';
  } else if (tr) {
    action = 'STAY IN CASH (bear trend)'; short = 'AVOID';
    entryPrice = d1?.resistance || currentPrice * 1.03;
    entryNote = 'Bearish. Only consider shorting near resistance — no long entries.';
    waitingFor = 'a relief bounce toward resistance to short, or macro to improve';
    dp = 'Protect capital. No longs.'; wp = 'Stay out until macro turns.';
  } else {
    action = 'NO TRADE — WAIT'; short = 'NEUTRAL'; entryPrice = 0;
    entryNote = 'No high-probability setup right now.';
    waitingFor = (macro.trend === 'NEUTRAL')
      ? 'macro to pick a direction (right now stocks up but USD/yields up cancel it out)'
      : 'weekly trend to align with macro';
    dp = 'No setup. Watch macro + ETF flows.'; wp = 'Monitor weekly chart for a turn.';
  }

  const hasLevels = (short === 'BUY' || short === 'SELL' || short === 'WAIT_BUY' || short === 'WAIT_SELL') && entryPrice > 0;
  const isLong = short === 'BUY' || short === 'WAIT_BUY';
  const sl = hasLevels ? (isLong ? entryPrice - atr * 1.5 : entryPrice + atr * 1.5) : 0;
  const tp1 = hasLevels ? (isLong ? entryPrice + atr * 2 : entryPrice - atr * 2) : 0;
  const tp2 = hasLevels ? (isLong ? entryPrice + atr * 3 : entryPrice - atr * 3) : 0;
  const pct = (x) => entryPrice > 0 ? Math.abs(((x - entryPrice) / entryPrice) * 100).toFixed(2) : '0';

  return {
    coin, currentPrice, chgPct, action, actionShort: short, entryPrice, entryNote, waitingFor, bias,
    confidence, layers, macroTrend: macro,
    etf: { signal: etfData.signal, last1d: etfData.last1d, net10d: etfData.net10d, hasEtf: etfData.hasEtf, funds: etfData.funds },
    timeframes: { '1w': w1?.overall || 'NEUTRAL', '1d': d1?.overall || 'NEUTRAL', '4h': h4?.overall || 'NEUTRAL', '1h': h1?.overall || 'NEUTRAL' },
    indicators: { '4h': h4?.indicators || {}, '1h': h1?.indicators || {} },
    rsi: { '4h': h4?.rsi, '1h': h1?.rsi },
    dailyPlan: dp, weeklyPlan: wp,
    levels: { entryPrice, sl, tp1, tp2, slPct: pct(sl), tp1Pct: pct(tp1), tp2Pct: pct(tp2), support: w1?.support || 0, resistance: w1?.resistance || 0, hasLevels },
    generatedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  const { coin = 'BTCUSDT', label = 'BTC' } = req.query;
  const key = 'rec_' + coin;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL) return res.status(200).json(cached.data);
  try {
    const e = ETF[label] || ETF.BTC;
    const etfData = { ...e, signal: etfSignalFrom(e.net10d, e.hasEtf) };
    const [macroRes, tfs] = await Promise.all([
      Promise.allSettled(Object.keys(MACRO).map(async k => { try { return [k, await fetchYahoo(k, '1d', '6mo')]; } catch (e) { return [k, null]; } })),
      fetchCryptoTFs(coin),
    ]);
    const macroData = Object.fromEntries(macroRes.map(r => r.value || ['', null]).filter(([k]) => k));
    const macroTrend = calcMacro(macroData);
    const rec = buildRec(macroTrend, etfData, tfs, label);
    const result = { rec, macroData, macroTrend };
    cache.set(key, { data: result, ts: Date.now() });
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
