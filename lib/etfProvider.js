import axios from 'axios';

// ---------------------------------------------------------------------------
// Embedded snapshot — used ONLY as a fallback when the live source is
// unavailable (no API key, network error, rate limit). Mirrors the original
// hardcoded data so the page never renders empty.
// ---------------------------------------------------------------------------
const FALLBACK = {
  asOf: '12 Jun 2026',
  live: false,
  assets: {
    BTC: {
      labels: ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'],
      daily: [-333.6,-733.4,-223.3,-125.3,-483.8,-519.1,-396.6,3.2,-325.7,-91.4,-77.4,-213.9,-22.5,85.9],
      total: 53673,
      funds: 'IBIT, FBTC, BITB, ARKB, GBTC + others',
    },
    ETH: {
      labels: ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'],
      daily: [-35.1,-67.1,-121.4,-18.0,-44.5,-90.2,-53.0,19.3,-6.0,82.4,-40.9,-35.5,-15.9,-4.9],
      total: 11215,
      funds: 'ETHA, FETH, ETHE + others',
    },
    SOL: {
      labels: ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'],
      daily: [0.0,0.6,0.5,1.3,0.0,6.5,-12.8,0.0,0.0,-0.5,0.8,0.0,-4.4,0.0],
      total: 1118,
      funds: 'BSOL, FSOL, GSOL + others',
    },
  },
};

// CoinGlass v4. BTC + ETH flow-history are documented; SOL may not exist on
// your plan yet — it falls back to the snapshot automatically if the call fails.
// Verify field names + plan access: https://docs.coinglass.com/reference/etf-flows-history
const BASE_URL = process.env.COINGLASS_BASE_URL || 'https://open-api-v4.coinglass.com';
const ENDPOINTS = {
  BTC: '/api/etf/bitcoin/flow-history',
  ETH: '/api/etf/ethereum/flow-history',
  SOL: '/api/etf/solana/flow-history',
};
const FUND_LABELS = {
  BTC: 'IBIT, FBTC, BITB, ARKB, GBTC + others',
  ETH: 'ETHA, FETH, ETHE + others',
  SOL: 'BSOL, FSOL, GSOL + others',
};

const fmtLabel = (ms) =>
  new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

async function fetchAsset(asset, apiKey) {
  const { data } = await axios.get(`${BASE_URL}${ENDPOINTS[asset]}`, {
    headers: { 'CG-API-KEY': apiKey, Accept: 'application/json' },
    timeout: 12000,
  });

  if (data?.code !== '0' && data?.code !== 'success') {
    throw new Error(`CoinGlass ${asset}: ${data?.msg || 'non-success response'}`);
  }

  const entries = (data.data || [])
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!entries.length) throw new Error(`CoinGlass ${asset}: empty data`);

  const last14 = entries.slice(-14);
  return {
    labels: last14.map((e) => fmtLabel(e.timestamp)),
    daily: last14.map((e) => Math.round((e.flow_usd / 1e6) * 10) / 10), // USD -> $m, 1dp
    total: Math.round(entries.reduce((s, e) => s + e.flow_usd, 0) / 1e6),
    funds: FUND_LABELS[asset],
  };
}

/**
 * Returns { asOf, live, assets: { BTC, ETH, SOL } }.
 * Any asset that fails individually keeps its snapshot value; if the whole
 * thing fails (or no key), returns the full FALLBACK with live:false.
 */
export async function getEtfFlows() {
  const apiKey = process.env.COINGLASS_API_KEY;
  if (!apiKey) return FALLBACK; // no key configured -> snapshot, clearly flagged

  const assets = {};
  let anyLive = false;

  await Promise.all(
    Object.keys(ENDPOINTS).map(async (asset) => {
      try {
        assets[asset] = await fetchAsset(asset, apiKey);
        anyLive = true;
      } catch (err) {
        console.error(`[etf] ${asset} live fetch failed, using snapshot:`, err.message);
        assets[asset] = FALLBACK.assets[asset];
      }
    })
  );

  if (!anyLive) return FALLBACK;

  const newest = assets.BTC?.labels?.[assets.BTC.labels.length - 1] || FALLBACK.asOf;
  return { asOf: newest, live: true, assets };
}

export { FALLBACK };
