// macroEngine.js
const axios = require('axios');
const { analyze } = require('./signalEngine');
const MACRO_ASSETS = {
  '^DJI':     {label:'Dow Jones',    icon:'building-bank',   weight:2,  bullishWhenUp:true},
  '^IXIC':    {label:'Nasdaq',       icon:'cpu',             weight:2,  bullishWhenUp:true},
  'GC=F':     {label:'Gold',         icon:'diamond',         weight:1,  bullishWhenUp:true},
  'CL=F':     {label:'Oil (WTI)',    icon:'droplet',         weight:-1, bullishWhenUp:false},
  'DX-Y.NYB': {label:'USD Index',    icon:'currency-dollar', weight:-2, bullishWhenUp:false},
  '^TNX':     {label:'US 10Y Yield', icon:'file-certificate',weight:-2, bullishWhenUp:false},
};
async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
  const {data} = await axios.get(url, {timeout:8000});
  const q = data.chart.result[0];
  const closes = q.indicators.quote[0].close.filter(Boolean);
  const vols = (q.indicators.quote[0].volume||[]).map(v=>v||0);
  const price = q.meta.regularMarketPrice;
  const chgPct = ((price-q.meta.chartPreviousClose)/q.meta.chartPreviousClose)*100;
  return {closes,vols,price,chgPct};
}
async function fetchMacroData() {
  const results = {};
  await Promise.all(Object.keys(MACRO_ASSETS).map(async sym => {
    try {
      const raw = await fetchYahoo(sym);
      const an = analyze(raw.closes, raw.vols);
      results[sym] = {...MACRO_ASSETS[sym], symbol:sym, price:raw.price, chgPct:raw.chgPct, analysis:an};
    } catch(e) { console.error(`Macro fetch failed for ${sym}:`, e.message); }
  }));
  return results;
}
function calcMacroTrend(macroData) {
  let score=0, total=0;
  Object.values(macroData).forEach(({analysis,weight,bullishWhenUp}) => {
    if (!analysis) return;
    const sig=analysis.overall;
    const isBull=sig==='BUY'||sig==='STRONG BUY';
    const isBear=sig==='SELL'||sig==='STRONG SELL';
    const w=Math.abs(weight);
    if (bullishWhenUp) { if(isBull)score+=w; else if(isBear)score-=w; }
    else { if(isBear)score+=w; else if(isBull)score-=w; }
    total+=w;
  });
  const pct=total>0?Math.round((score/total)*100):0;
  const trend=pct>=40?'BULL':pct<=-40?'BEAR':pct>=15?'MILD BULL':pct<=-15?'MILD BEAR':'NEUTRAL';
  return {score,pct,trend};
}
module.exports = {fetchMacroData,calcMacroTrend,MACRO_ASSETS};