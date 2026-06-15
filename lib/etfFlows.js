// lib/etfFlows.js
// REAL BTC / ETH / SOL spot-ETF daily net flows (US$ millions).
// Source: Farside Investors (farside.co.uk) — data through 12 Jun 2026.
//
// NOTE: this is a fixed SNAPSHOT, not a live feed. To make it live,
// point a server-side fetch at Farside's public Google Sheet CSV export
// or a flows API (CoinGlass / SoSoValue) and replace SNAPSHOT below.

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

function summarise(asset) {
  const d = FLOWS[asset].daily;
  const latest = d[d.length - 1];
  const tenDay = d.slice(-10).reduce((a, b) => a + b, 0);
  return { latest, tenDay, cumulativeTotal: FLOWS[asset].cumulativeTotal };
}

module.exports = { LABELS, FLOWS, SNAPSHOT_DATE, summarise };
