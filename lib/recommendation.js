const axios = require('axios');
const { analyze } = require('./signalEngine');
const TIMEFRAMES = ['1w','1d','4h','1h'];
async function fetchBinance(sym, tf, limit=200) {
  const {data}=await axios.get('https://api.binance.com/api/v3/klines?symbol='+sym+'&interval='+tf+'&limit='+limit,{timeout:8000});
  if(!Array.isArray(data))return null;
  const c=data.map(k=>parseFloat(k[4]));const v=data.map(k=>parseFloat(k[5]));
  return {closes:c,vols:v,analysis:analyze(c,v)};
}
async function fetchAllTimeframes(sym){
  const tfs={};
  await Promise.all(TIMEFRAMES.map(async tf=>{try{tfs[tf]=await fetchBinance(sym,tf);}catch(e){}}));
  return tfs;
}
function isBull(s){return s==='BUY'||s==='STRONG BUY';}
function isBear(s){return s==='SELL'||s==='STRONG SELL';}
function buildRecommendation(macro,tfs,coin){
  const w=tfs['1w']?.analysis,d=tfs['1d']?.analysis,h4=tfs['4h']?.analysis,h1=tfs['1h']?.analysis;
  const price=h1?.price||d?.price||0,chgPct=h1?.chgPct||0,atr=h4?.atr||d?.atr||0;
  const mb=macro.trend==='BULL'||macro.trend==='MILD BULL',mr=macro.trend==='BEAR'||macro.trend==='MILD BEAR';
  const tb=mb&&isBull(w?.overall),tr=mr&&isBear(w?.overall);
  const h4b=isBull(h4?.overall),h4r=isBear(h4?.overall),h1b=isBull(h1?.overall),h1r=isBear(h1?.overall);
  let l=0;if(mb||mr)l++;if(tb||tr)l++;if((tb&&isBull(d?.overall))||(tr&&isBear(d?.overall)))l++;if((tb&&h4b)||(tr&&h4r))l++;if((tb&&h1b)||(tr&&h1r))l++;
  const conf=Math.round((l/5)*100);
  let action,short,dp,wp;
  if(tb&&h4b&&h1b){action='▲ BUY NOW';short='BUY';dp='Enter long now.';wp='Hold 3-5 days targeting resistance.';}
  else if(tb&&h4b){action='▲ Wait for 1h confirm';short='WAIT_BUY';dp='Wait for 1h buy.';wp='Entry zone forming.';}
  else if(tb){action='▲ Bull — wait pullback';short='WAIT_BUY';dp='Wait for pullback.';wp='Buy next dip to support.';}
  else if(tr&&h4r&&h1r){action='▼ SELL / AVOID';short='SELL';dp='Exit longs.';wp='Stay cash.';}
  else if(tr&&h4r){action='▼ Wait for 1h sell';short='WAIT_SELL';dp='Avoid buys.';wp='Hold cash.';}
  else if(tr){action='▼ Bear — stay cash';short='AVOID';dp='Protect capital.';wp='Stay out.';}
  else{action='— Wait';short='NEUTRAL';dp='No setup.';wp='Monitor macro.';}
  const ib=short==='BUY';const sl=ib?price-atr*1.5:price+atr*1.5,tp1=ib?price+atr*2:price-atr*2,tp2=ib?price+atr*3:price-atr*3;
  return {coin,price,chgPct,action,actionShort:short,confidence:conf,layers:l,macroTrend:macro,
    timeframes:{'1w':w?.overall||'NEUTRAL','1d':d?.overall||'NEUTRAL','4h':h4?.overall||'NEUTRAL','1h':h1?.overall||'NEUTRAL'},
    indicators:{'4h':h4?.indicators||{},'1h':h1?.indicators||{}},rsi:{'4h':h4?.rsi,'1h':h1?.rsi},
    dailyPlan:dp,weeklyPlan:wp,
    levels:{price,sl,tp1,tp2,slPct:Math.abs(((sl-price)/price)*100).toFixed(2),tp1Pct:Math.abs(((tp1-price)/price)*100).toFixed(2),tp2Pct:Math.abs(((tp2-price)/price)*100).toFixed(2),support:w?.support||0,resistance:w?.resistance||0},
    generatedAt:new Date().toISOString()};
}
module.exports={fetchAllTimeframes,buildRecommendation};