// lib/etfEngine.js - BTC ETF Cash Flow Analysis
// Tracks: IBIT(BlackRock), FBTC(Fidelity), ARKB(ARK), BITB(Bitwise), HODL(VanEck), GBTC(Grayscale)
// Use in dashboard to show institutional money flow into BTC ETFs

const ETF_META = {
  IBIT: {name:'BlackRock iShares', weight:3, color:'#185FA5'},
  FBTC: {name:'Fidelity',          weight:2, color:'#534AB7'},
  ARKB: {name:'ARK 21Shares',      weight:2, color:'#1D9E75'},
  BITB: {name:'Bitwise',           weight:1, color:'#BA7517'},
  HODL: {name:'VanEck',            weight:1, color:'#993C1D'},
  GBTC: {name:'Grayscale',         weight:2, color:'#A32D2D'},
};

// How to read ETF flows:
// +$200M/day = strong institutional buying = bullish for BTC price
// -$100M/day = outflows = bearish pressure
// IBIT has highest weight as largest BTC ETF by AUM (BlackRock)
// GBTC often has outflows as legacy product with higher fees

module.exports = { ETF_META };