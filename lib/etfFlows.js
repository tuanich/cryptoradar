// lib/etfFlows.js
// BTC / ETH / SOL spot-ETF daily net flows (US$ millions).
// Now LIVE: delegates to lib/etfProvider.js (CoinGlass) with a short cache and
// automatic fallback to the embedded snapshot when the live source is
// unavailable (no API key, rate limit, network error).
//
// Requires lib/etfProvider.js (added in the earlier /etf-page fix). If you
// didn't keep that file, say so and this can be made self-contained instead.
const { getEtfFlows } = require('./etfProvider');

// ---- Embedded snapshot — fallback only -----------------------------------
const SNAPSHOT_DATE = '12 Jun 2026';
const LABELS = ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'];
const FLOWS = {
  BTC: {
    daily: [-333.6,-733.4,-223.3,-125.3,-483.8,-519.1,-396.6,3.2,-325.7,-91.4,-77.4,-213.9,-22.5,85.9],
    cumulativeTotal: 53673, // US$m since launch
    funds: 'IBIT, FBTC, BITB, ARKB, GBTC + others',
  },
  ETH: {
    daily: [-35.1,-67.1,-121.4,-18.0,-44.5,-90.2,-53.0,19.3,-6.0,82.4,-40.9,-35.5,-15.9,-4.9],
    cumulativeTotal: 11215,
    funds: 'ETHA, FETH, ETHE + others',
  },
  SOL: {
    daily: [0.0,0.6,0.5,1.3,0.0,6.5,-12.8,0.0,0.0,-0.5,0.8,0.0,-4.4,0.0],
    cumulativeTotal: 1118,
    funds: 'BSOL, FSOL, GSOL + others',
  },
};
const HAS_ETF = ['BTC', 'ETH', 'SOL'];

// ---- Live fetch with short cache -----------------------------------------
const TTL_MS = 5 * 60 * 1000;
let cache = { data: null, ts: 0 };

async function getFlows() {
  const now = Date.now();
  if (!cache.data || now - cache.ts > TTL_MS) {
    cache = { data: await getEtfFlows(), ts: now }; // { asOf, live, assets: {...} }
  }
  return cache.data;
}

/**
 * Async summary for one asset — use this in /api/recommendation.
 * Returns { hasEtf, latest, tenDay, cumulativeTotal, funds, lastDate, live }.
 */
async function getSummary(asset) {
  if (!HAS_ETF.includes(asset)) return { hasEtf: false };

  try {
    const flows = await getFlows();
    const a = flows.assets[asset];
    const d = a.daily;
    return {
      hasEtf: true,
      latest: d[d.length - 1],
      tenDay: d.slice(-10).reduce((x, y) => x + y, 0),
      cumulativeTotal: a.total,
      funds: a.funds,
      lastDate: a.labels[a.labels.length - 1], // e.g. "13 Jun"
      live: flows.live,
    };
  } catch (e) {
    // Hard fallback to snapshot if anything above throws.
    const s = FLOWS[asset];
    return {
      hasEtf: true,
      latest: s.daily[s.daily.length - 1],
      tenDay: s.daily.slice(-10).reduce((x, y) => x + y, 0),
      cumulativeTotal: s.cumulativeTotal,
      funds: s.funds,
      lastDate: SNAPSHOT_DATE,
      live: false,
    };
  }
}

// ---- Deprecated sync version (snapshot only) — kept for backward compat ----
function summarise(asset) {
  const d = FLOWS[asset].daily;
  return {
    latest: d[d.length - 1],
    tenDay: d.slice(-10).reduce((a, b) => a + b, 0),
    cumulativeTotal: FLOWS[asset].cumulativeTotal,
  };
}

module.exports = { LABELS, FLOWS, SNAPSHOT_DATE, summarise, getFlows, getSummary };
