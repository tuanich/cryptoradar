// lib/etfProvider.js
// Keyless LIVE spot-ETF flows by parsing Farside Investors' public tables
// (BTC/ETH/SOL). No API key, no paid plan. Falls back to the embedded snapshot
// if the fetch/parse fails (Cloudflare block, layout change, network error).
const axios = require('axios');

// ---- Embedded snapshot — fallback only -----------------------------------
const FALLBACK = {
  asOf: '12 Jun 2026',
  live: false,
  assets: {
    BTC: { labels: ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'], daily: [-333.6,-733.4,-223.3,-125.3,-483.8,-519.1,-396.6,3.2,-325.7,-91.4,-77.4,-213.9,-22.5,85.9], total: 53673, funds: 'IBIT, FBTC, BITB, ARKB, GBTC + others' },
    ETH: { labels: ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'], daily: [-35.1,-67.1,-121.4,-18.0,-44.5,-90.2,-53.0,19.3,-6.0,82.4,-40.9,-35.5,-15.9,-4.9], total: 11215, funds: 'ETHA, FETH, ETHE + others' },
    SOL: { labels: ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'], daily: [0.0,0.6,0.5,1.3,0.0,6.5,-12.8,0.0,0.0,-0.5,0.8,0.0,-4.4,0.0], total: 1118, funds: 'BSOL, FSOL, GSOL + others' },
  },
};

const SOURCES = {
  BTC: 'https://farside.co.uk/btc/',
  ETH: 'https://farside.co.uk/eth/',
  SOL: 'https://farside.co.uk/sol/',
};
const FUND_LABELS = {
  BTC: 'IBIT, FBTC, BITB, ARKB, GBTC + others',
  ETH: 'ETHA, FETH, ETHE + others',
  SOL: 'BSOL, FSOL, GSOL + others',
};
const DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+\d{4}$/;

// "(733.4)" -> -733.4 ; "53,673" -> 53673 ; "-" / "" -> null
function parseNum(raw) {
  const s = String(raw).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (s === '' || s === '-' || s === '\u2013') return null;
  const neg = /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[(),]/g, ''));
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

// Parse Farside's flow table -> { series: [{label, value}], cumulativeTotal }
function parseFarside(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c =>
      c[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    )
  );

  const series = [];
  let cumulativeTotal = null;

  for (const cells of rows) {
    if (!cells.length) continue;
    const first = cells[0];

    if (/^total$/i.test(first)) {
      cumulativeTotal = parseNum(cells[cells.length - 1]);
      continue;
    }
    const m = first.match(DATE_RE);
    if (!m) continue;

    const middle = cells.slice(1, -1).map(parseNum);
    if (!middle.some(v => v !== null)) continue; // skip empty/future day (all "-")

    series.push({ label: m[1] + ' ' + m[2], value: parseNum(cells[cells.length - 1]) ?? 0 });
  }
  return { series, cumulativeTotal };
}

async function fetchAsset(asset) {
  const res = await axios.get(SOURCES[asset], {
    timeout: 12000,
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const { series, cumulativeTotal } = parseFarside(res.data);
  if (!series.length) throw new Error('Farside ' + asset + ': no data rows parsed');

  const last14 = series.slice(-14);
  return {
    labels: last14.map(s => s.label),
    daily: last14.map(s => Math.round(s.value * 10) / 10),
    total: cumulativeTotal ?? Math.round(series.reduce((a, s) => a + s.value, 0)),
    funds: FUND_LABELS[asset],
  };
}

/**
 * Returns { asOf, live, assets: { BTC, ETH, SOL } }.
 * Any asset that fails keeps its snapshot; if all fail, returns FALLBACK.
 */
async function getEtfFlows() {
  const assets = {};
  let anyLive = false;

  await Promise.all(
    Object.keys(SOURCES).map(async (asset) => {
      try {
        assets[asset] = await fetchAsset(asset);
        anyLive = true;
      } catch (err) {
        console.error('[etf] ' + asset + ' Farside fetch failed, using snapshot:', err.message);
        assets[asset] = FALLBACK.assets[asset];
      }
    })
  );

  if (!anyLive) return FALLBACK;

  const newest = (assets.BTC && assets.BTC.labels[assets.BTC.labels.length - 1]) || FALLBACK.asOf;
  return { asOf: newest, live: true, assets };
}

module.exports = { getEtfFlows, FALLBACK };
