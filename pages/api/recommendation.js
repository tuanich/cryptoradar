// pages/api/recommendation.js
// native fetch only - no axios - works on Vercel
// Includes: Binance prices + Yahoo Finance macro + BTC ETF flows

const cache = new Map();
const TTL = 90000;

function ema(a,n){const k=2/(n+1);let e=a[0];for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k);return e;}

function analyze(closes,vols){
  if(!closes||closes.length<52)return null;
  if(!vols||!vols.length)vols=new Array(closes.length).fill(1);
  const ma20=closes.slice(-20).reduce((a,b)=>a+b,0)/20;
  const ma50=closes.slice(-50).reduce((a,b)=>a+b,0)/50;
  const md=((ma20-ma50)/ma50)*100;
  const maSig=md>1?'STRONG BUY':md>0.1?'BUY':md<-1?'STRONG SELL':md<-0.1?'SELL':'NEUTRAL';
  let g=0,l=0;
  for(let i=closes.length-14;i<closes.length;i++){const d=closes[i]-closes[i-1];d>0?g+=d:l+=Math.abs(d);}
  const rsi=100-(100/(1+(g/14)/((l/14)||0.001)));
  const rsiSig=rsi<25?'STRONG BUY':rsi<35?'BUY':rsi>75?'STRONG SELL':rsi>65?'SELL':'NEUTRAL';
  const macdL=ema(closes,12)-ema(closes,26);
  const macdSig=macdL>0?'BUY':'SELL';
  const hi=Math.max(...closes.slice(-20)),lo=Math.min(...closes.slice(-20));
  const pos=(closes[closes.length-1]-lo)/((hi-lo)||1);
  const srSig=pos<0.25?'BUY':pos>0.75?'SELL':'NEUTRAL';
  const avgV=(vols.slice(-20,-1).reduce((a,b)=>a+b,0)/19)||1;
  const chg=closes[closes.length-1]-closes[closes.length-2];
  const vr=(vols[vols.length-1]||1)/avgV;
  const volSig=vr>1.5&&chg>0?'BUY':vr>1.5&&chg<0?'SELL':'NEUTRAL';
  const M={'STRONG BUY':2,'BUY':1,'NEUTRAL':0,'SELL':-1,'STRONG SELL':-2};
  const score=M[maSig]+M[rsiSig]+M[macdSig]+M[srSig]+M[volSig];
  const overall=score>=4?'STRONG BUY':score>=2?'BUY':score<=-4?'STRONG SELL':score<=-2?'SELL':'NEUTRAL';
  const atr=closes.slice(-14).reduce((s,c,i,a)=>s+(i>0?Math.abs(c-a[i-1]):0),0)/13;
  return{overall,score,indicators:{maSig,rsiSig,macdSig,srSig,volSig},
    rsi:parseFloat(rsi.toFixed(1)),atr,price:closes[closes.length-1],
    chgPct:((closes[closes.length-1]-closes[closes.length-2])/closes[closes.length-2])*100,
    support:lo,resistance:hi};
}

async function fetchBinance(sym,tf){
  const r=await fetch('https://api.binance.com/api/v3/klines?symbol='+sym+'&interval='+tf+'&limit=120');
  if(!r.ok)throw new Error('Binance '+sym+':'+r.status);
  const d=await r.json();
  const closes=d.map(k=>parseFloat(k[4]));
  const vols=d.map(k=>parseFloat(k[5]));
  return{closes,vols,analysis:analyze(closes,vols)};
}

async function fetchYahoo(sym){
  const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?interval=1d&range=6mo',{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok)throw new Error('Yahoo '+sym+':'+r.status);
  const d=await r.json();
  const q=d.chart.result[0];
  const closes=q.indicators.quote[0].close.filter(Boolean);
  const vols=(q.indicators.quote[0].volume||[]).map(v=>v||0);
  const price=q.meta.regularMarketPrice;
  const chgPct=((price-q.meta.chartPreviousClose)/q.meta.chartPreviousClose)*100;
  return{closes,vols,price,chgPct,analysis:analyze(closes,vols)};
}

const MACRO={'^DJI':{label:'Dow Jones',w:2,up:true},'^IXIC':{label:'Nasdaq',w:2,up:true},'GC=F':{label:'Gold',w:1,up:true},'CL=F':{label:'Oil',w:-1,up:false},'DX-Y.NYB':{label:'USD Index',w:-2,up:false},'^TNX':{label:'US 10Y',w:-2,up:false}};
const ETF_W={IBIT:3,FBTC:2,ARKB:2,BITB:1,HODL:1,GBTC:2};
const ETF_NAMES={IBIT:'BlackRock',FBTC:'Fidelity',ARKB:'ARK',BITB:'Bitwise',HODL:'VanEck',GBTC:'Grayscale'};

async function fetchEtfFlows(){
  const flows={};
  await Promise.allSettled(['IBIT','FBTC','ARKB','BITB','HODL','GBTC'].map(async t=>{
    try{const d=await fetchYahoo(t);const v=d.vols[d.vols.length-1]||1;
      flows[t]={name:ETF_NAMES[t],price:d.price,chgPct:d.chgPct,
        flow1d:d.chgPct>0?(v*d.price/1e6*0.06):-(v*d.price/1e6*0.06)};}
    catch(e){}
  }));
  let net=0,tw=0;
  Object.entries(flows).forEach(([t,f])=>{const w=ETF_W[t]||1;net+=f.flow1d*w;tw+=w;});
  const nf=tw>0?parseFloat((net/tw).toFixed(1)):0;
  const sig=nf>80?'STRONG BUY':nf>20?'BUY':nf<-50?'STRONG SELL':nf<-15?'SELL':'NEUTRAL';
  return{flows,netFlow:nf,etfSignal:sig};
}

function calcMacro(md){
  let score=0,total=0;
  Object.entries(md).forEach(([k,d])=>{const c=MACRO[k];if(!d?.analysis||!c)return;
    const sig=d.analysis.overall,bull=sig==='BUY'||sig==='STRONG BUY',bear=sig==='SELL'||sig==='STRONG SELL',w=Math.abs(c.w);
    c.up?(bull?score+=w:bear?score-=w:0):(bear?score+=w:bull?score-=w:0);total+=w;});
  const pct=total>0?Math.round((score/total)*100):0;
  const trend=pct>=40?'BULL':pct<=-40?'BEAR':pct>=15?'MILD BULL':pct<=-15?'MILD BEAR':'NEUTRAL';
  return{score,pct,trend};
}

function buildRec(macro,etf,tfs,coin){
  const w1=tfs['1w']?.analysis,d1=tfs['1d']?.analysis,h4=tfs['4h']?.analysis,h1=tfs['1h']?.analysis;
  const price=h1?.price||d1?.price||0,chgPct=h1?.chgPct||0,atr=h4?.atr||d1?.atr||0;
  const bull=s=>s==='BUY'||s==='STRONG BUY',bear=s=>s==='SELL'||s==='STRONG SELL';
  const mb=macro.trend==='BULL'||macro.trend==='MILD BULL',mr=macro.trend==='BEAR'||macro.trend==='MILD BEAR';
  const eb=bull(etf.etfSignal),er=bear(etf.etfSignal);
  const tb=mb&&bull(w1?.overall),tr=mr&&bear(w1?.overall);
  let L=0;if(mb||mr)L++;if(eb||er)L++;if(tb||tr)L++;
  if((tb&&bull(d1?.overall))||(tr&&bear(d1?.overall)))L++;
  if((tb&&bull(h4?.overall))||(tr&&bear(h4?.overall)))L++;
  const conf=Math.round((L/5)*100);
  let action,short,dp,wp;
  if(tb&&eb&&bull(h4?.overall)&&bull(h1?.overall)){action='\u25b2 BUY NOW';short='BUY';dp='ETF inflow+macro+tech confirm. Enter long.';wp='Hold 3-5 days. Target weekly resistance.';}
  else if(tb&&bull(h4?.overall)){action='\u25b2 Prepare to buy';short='WAIT_BUY';dp='4h ready. Wait 1h confirm.';wp='Entry forming.';}
  else if(tb){action='\u25b2 Bull - wait pullback';short='WAIT_BUY';dp='Wait for pullback.';wp='Buy next dip.';}
  else if(tr&&er&&bear(h4?.overall)&&bear(h1?.overall)){action='\u25bc SELL / AVOID';short='SELL';dp='ETF outflow+macro+tech confirm bear.';wp='Stay cash.';}
  else if(tr&&bear(h4?.overall)){action='\u25bc Prepare to sell';short='WAIT_SELL';dp='Avoid buys.';wp='Hold cash.';}
  else if(tr){action='\u25bc Bear - stay cash';short='AVOID';dp='Protect capital.';wp='Stay out.';}
  else{action='\u2014 Wait';short='NEUTRAL';dp='No setup.';wp='Monitor macro.';}
  const ib=short==='BUY';
  const sl=price>0?(ib?price-atr*1.5:price+atr*1.5):0;
  const tp1=price>0?(ib?price+atr*2:price-atr*2):0;
  const tp2=price>0?(ib?price+atr*3:price-atr*3):0;
  return{coin,price,chgPct,action,actionShort:short,confidence:conf,layers:L,macroTrend:macro,
    etf:{signal:etf.etfSignal,netFlow1d:etf.netFlow,flows:etf.flows},
    timeframes:{'1w':w1?.overall||'NEUTRAL','1d':d1?.overall||'NEUTRAL','4h':h4?.overall||'NEUTRAL','1h':h1?.overall||'NEUTRAL'},
    indicators:{'4h':h4?.indicators||{},'1h':h1?.indicators||{}},
    rsi:{'4h':h4?.rsi,'1h':h1?.rsi},dailyPlan:dp,weeklyPlan:wp,
    levels:{price,sl,tp1,tp2,
      slPct:price>0?Math.abs(((sl-price)/price)*100).toFixed(2):'0',
      tp1Pct:price>0?Math.abs(((tp1-price)/price)*100).toFixed(2):'0',
      tp2Pct:price>0?Math.abs(((tp2-price)/price)*100).toFixed(2):'0',
      support:w1?.support||0,resistance:w1?.resistance||0},
    generatedAt:new Date().toISOString()};
}

export default async function handler(req,res){
  const{coin='BTCUSDT',label='BTC'}=req.query;
  const key='rec_'+coin;
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.ts<TTL)return res.status(200).json(cached.data);
  try{
    const[macroRes,tfsArr,etfData]=await Promise.all([
      Promise.allSettled(Object.keys(MACRO).map(async k=>{try{return[k,await fetchYahoo(k)];}catch(e){return[k,null];}})),
      Promise.all(['1w','1d','4h','1h'].map(tf=>fetchBinance(coin,tf).catch(()=>null))),
      fetchEtfFlows()
    ]);
    const macroData=Object.fromEntries(macroRes.map(r=>r.value||['',null]).filter(([k])=>k));
    const tfs={'1w':tfsArr[0],'1d':tfsArr[1],'4h':tfsArr[2],'1h':tfsArr[3]};
    const macroTrend=calcMacro(macroData);
    const rec=buildRec(macroTrend,etfData,tfs,label);
    const result={rec,macroData,macroTrend};
    cache.set(key,{data:result,ts:Date.now()});
    res.status(200).json(result);
  }catch(e){res.status(500).json({error:e.message});}
}