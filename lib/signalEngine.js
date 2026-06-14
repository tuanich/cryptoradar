// signalEngine.js — 5-indicator technical analysis
function ema(arr, n) {
  const k = 2 / (n + 1); let e = arr[0];
  for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}
function scoreMap(sig) {
  return { 'STRONG BUY': 2, 'BUY': 1, 'NEUTRAL': 0, 'SELL': -1, 'STRONG SELL': -2 }[sig] ?? 0;
}
function overallFromScore(score) {
  if (score >= 4) return 'STRONG BUY'; if (score >= 2) return 'BUY';
  if (score <= -4) return 'STRONG SELL'; if (score <= -2) return 'SELL';
  return 'NEUTRAL';
}
function analyze(closes, vols = []) {
  if (!closes || closes.length < 52) return null;
  if (!vols.length) vols = new Array(closes.length).fill(1);
  const ma20 = closes.slice(-20).reduce((a,b)=>a+b,0)/20;
  const ma50 = closes.slice(-50).reduce((a,b)=>a+b,0)/50;
  const maDiff = ((ma20-ma50)/ma50)*100;
  const maSig = maDiff>1?'STRONG BUY':maDiff>0.1?'BUY':maDiff<-1?'STRONG SELL':maDiff<-0.1?'SELL':'NEUTRAL';
  let gains=0,losses=0;
  for(let i=closes.length-14;i<closes.length;i++){const d=closes[i]-closes[i-1];if(d>0)gains+=d;else losses+=Math.abs(d);}
  const rsi=100-(100/(1+(gains/14)/((losses/14)||0.001)));
  const rsiSig=rsi<25?'STRONG BUY':rsi<35?'BUY':rsi>75?'STRONG SELL':rsi>65?'SELL':'NEUTRAL';
  const macdLine=ema(closes,12)-ema(closes,26);
  const macdSig=macdLine>0?'BUY':macdLine<0?'SELL':'NEUTRAL';
  const hi=Math.max(...closes.slice(-20)),lo=Math.min(...closes.slice(-20));
  const pos=(closes[closes.length-1]-lo)/((hi-lo)||1);
  const srSig=pos<0.25?'BUY':pos>0.75?'SELL':'NEUTRAL';
  const avgVol=(vols.slice(-20,-1).reduce((a,b)=>a+b,0)/19)||1;
  const lastVol=vols[vols.length-1]||1;
  const volRatio=lastVol/avgVol;
  const chg=closes[closes.length-1]-closes[closes.length-2];
  const volSig=volRatio>1.5&&chg>0?'BUY':volRatio>1.5&&chg<0?'SELL':'NEUTRAL';
  const score=scoreMap(maSig)+scoreMap(rsiSig)+scoreMap(macdSig)+scoreMap(srSig)+scoreMap(volSig);
  const overall=overallFromScore(score);
  const atr=closes.slice(-14).reduce((s,c,i,a)=>s+(i>0?Math.abs(c-a[i-1]):0),0)/13;
  const price=closes[closes.length-1];
  const chgPct=((price-closes[closes.length-2])/closes[closes.length-2])*100;
  return { overall,score,indicators:{maSig,rsiSig,macdSig,srSig,volSig},
    rsi:parseFloat(rsi.toFixed(1)),atr,price,chgPct,support:lo,resistance:hi,ma20,ma50,
    bars:{ma:Math.min(100,Math.max(0,50+maDiff*8)),rsi:Math.min(100,rsi),macd:macdLine>0?65:35,sr:Math.min(100,pos*100),vol:Math.min(100,volRatio*50)}};
}
module.exports = { analyze };