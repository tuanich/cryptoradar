import{useState,useEffect,useCallback}from'react';

const COINS=[{sym:'BTCUSDT',label:'BTC'},{sym:'ETHUSDT',label:'ETH'},{sym:'SOLUSDT',label:'SOL'},{sym:'BNBUSDT',label:'BNB'}];
const fmtP=p=>p>100?'$'+p.toLocaleString(undefined,{maximumFractionDigits:0}):'$'+parseFloat(p||0).toFixed(2);
const fmtM=m=>{const a=Math.abs(m||0);return(m>=0?'+':'-')+'$'+(a>=1000?(a/1000).toFixed(1)+'B':a.toFixed(0)+'M');};

function Badge({sig}){
  const m={'STRONG BUY':{bg:'#3B6D11',c:'#EAF3DE',t:'▲▲ Strong buy'},'BUY':{bg:'#EAF3DE',c:'#27500A',t:'▲ Buy'},'NEUTRAL':{bg:'#F1EFE8',c:'#444441',t:'— Neutral'},'SELL':{bg:'#FCEBEB',c:'#791F1F',t:'▼ Sell'},'STRONG SELL':{bg:'#A32D2D',c:'#FCEBEB',t:'▼▼ Strong sell'}};
  const s=m[sig]||m['NEUTRAL'];
  return <span style={{background:s.bg,color:s.c,borderRadius:6,padding:'2px 10px',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>{s.t}</span>;
}

function Row({label,value,color}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'0.5px solid #f0ede8',fontSize:13}}>
      <span style={{color:'#666'}}>{label}</span>
      <strong style={{color:color||'#222'}}>{value}</strong>
    </div>
  );
}

export default function Dashboard(){
  const[coin,setCoin]=useState(COINS[0]);
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[upd,setUpd]=useState('');
  const[log,setLog]=useState([]);
  const[tgStatus,setTgStatus]=useState('');

  const load=useCallback(async()=>{
    try{
      const r=await fetch('/api/recommendation?coin='+coin.sym+'&label='+coin.label+'&_='+Date.now());
      const j=await r.json();
      if(j.error){console.error('API error:',j.error);return;}
      setData(prev=>{
        if(prev?.rec?.actionShort&&prev.rec.actionShort!==j.rec?.actionShort)
          setLog(l=>[{ts:new Date().toLocaleTimeString(),coin:coin.label,from:prev.rec.actionShort,to:j.rec.actionShort,conf:j.rec.confidence},...l.slice(0,19)]);
        return j;
      });
      setUpd(new Date().toLocaleTimeString());
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[coin]);

  useEffect(()=>{setLoading(true);setData(null);load();},[load]);
  useEffect(()=>{const t=setInterval(load,60000);return()=>clearInterval(t);},[load]);

  const sendTg=async()=>{
    if(!data?.rec)return;
    setTgStatus('Sending...');
    try{
      const rec=data.rec;
      const msg='Signal: '+coin.label+' '+rec.action+' | Price:'+fmtP(rec.price)+' | SL:'+fmtP(rec.levels?.sl)+' | TP1:'+fmtP(rec.levels?.tp1)+' | ETF:'+rec.etf?.etfSignal+' | Conf:'+rec.confidence+'%';
      const r=await fetch('/api/telegram/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
      const j=await r.json();
      setTgStatus(j.ok?'Sent!':'Failed');
    }catch{setTgStatus('Error');}
    setTimeout(()=>setTgStatus(''),3000);
  };

  const rec=data?.rec,md=data?.macroData,etf=rec?.etf;
  const isBuy=rec?.actionShort==='BUY';
  const isSell=rec?.actionShort==='SELL';
  const isWaitBuy=rec?.actionShort==='WAIT_BUY';
  const isWaitSell=rec?.actionShort==='WAIT_SELL';
  const isAvoid=rec?.actionShort==='AVOID';

  const actionBg=isBuy?'#EAF3DE':isSell?'#FCEBEB':(isWaitBuy||isWaitSell)?'#FAEEDA':'#F1EFE8';
  const actionBorder=isBuy?'3px solid #3B6D11':isSell?'3px solid #A32D2D':(isWaitBuy||isWaitSell)?'2px solid #BA7517':'2px solid #B4B2A9';
  const actionColor=isBuy?'#1A4A06':isSell?'#6B1010':(isWaitBuy||isWaitSell)?'#5C3200':'#333';
  const confColor=(rec?.confidence||0)>=80?'#3B6D11':(rec?.confidence||0)>=60?'#BA7517':'#A32D2D';
  const macroSig=rec?.macroTrend?.trend;
  const macroAsBadge=(macroSig==='BULL'||macroSig==='MILD BULL')?'BUY':(macroSig==='BEAR'||macroSig==='MILD BEAR')?'SELL':'NEUTRAL';

  const card={background:'#fff',border:'0.5px solid #e0ddd8',borderRadius:14,padding:'1rem',marginBottom:'1rem'};

  return(
    <div style={{minHeight:'100vh',background:'#f5f4f1',fontFamily:'system-ui,sans-serif',padding:'1rem'}}>
    <div style={{maxWidth:980,margin:'0 auto'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:700}}>CryptoRadar</h1>
          <p style={{margin:0,fontSize:12,color:'#888'}}>Macro + ETF + Technical → Signal + Action Price</p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {COINS.map(c=>(
            <button key={c.sym} onClick={()=>setCoin(c)} style={{padding:'6px 16px',borderRadius:8,border:'0.5px solid',cursor:'pointer',fontSize:13,fontWeight:600,
              background:coin.sym===c.sym?'#534AB7':'#fff',color:coin.sym===c.sym?'#fff':'#333',borderColor:coin.sym===c.sym?'#534AB7':'#ddd'}}>{c.label}</button>
          ))}
          <button onClick={load} style={{padding:'6px 14px',borderRadius:8,border:'0.5px solid #ddd',cursor:'pointer',fontSize:13,background:'#fff'}}>↻ Refresh</button>
          <button onClick={sendTg} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,background:'#0088cc',color:'#fff',fontWeight:600}}>
            📱 {tgStatus||'Telegram'}
          </button>
        </div>
      </div>

      {loading&&<div style={{textAlign:'center',padding:'3rem',color:'#888',fontSize:15}}>Loading market data...</div>}

      {!loading&&rec&&<>

        {/* ═══════════════════════════════════════════
            MAIN CONCLUSION — most visible section
        ═══════════════════════════════════════════ */}
        <div style={{background:actionBg,border:actionBorder,borderRadius:16,padding:'1.5rem',marginBottom:'1rem'}}>
          <div style={{fontSize:13,fontWeight:500,color:'#666',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Final recommendation</div>
          <div style={{fontSize:32,fontWeight:800,color:actionColor,marginBottom:12}}>{rec.action}</div>

          {/* Price action grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:14}}>
            <div style={{background:'rgba(0,0,0,0.06)',borderRadius:10,padding:'10px 14px'}}>
              <div style={{fontSize:11,color:'#555',marginBottom:3}}>📍 Action price</div>
              <div style={{fontSize:22,fontWeight:800}}>{fmtP(rec.price)}</div>
              <div style={{fontSize:12,color:rec.chgPct>=0?'#27500A':'#A32D2D'}}>{rec.chgPct>=0?'+':''}{(rec.chgPct||0).toFixed(2)}% (1h)</div>
            </div>
            {rec.levels?.sl>0&&(
              <div style={{background:'rgba(163,45,45,0.1)',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontSize:11,color:'#555',marginBottom:3}}>🛑 Stop loss</div>
                <div style={{fontSize:22,fontWeight:800,color:'#A32D2D'}}>{fmtP(rec.levels.sl)}</div>
                <div style={{fontSize:12,color:'#888'}}>-{rec.levels.slPct}% from entry</div>
              </div>
            )}
            {rec.levels?.tp1>0&&(
              <div style={{background:'rgba(59,109,17,0.08)',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontSize:11,color:'#555',marginBottom:3}}>✅ Take profit 1</div>
                <div style={{fontSize:22,fontWeight:800,color:'#27500A'}}>{fmtP(rec.levels.tp1)}</div>
                <div style={{fontSize:12,color:'#888'}}>+{rec.levels.tp1Pct}% · close 50%</div>
              </div>
            )}
            {rec.levels?.tp2>0&&(
              <div style={{background:'rgba(59,109,17,0.08)',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontSize:11,color:'#555',marginBottom:3}}>🎯 Take profit 2</div>
                <div style={{fontSize:22,fontWeight:800,color:'#27500A'}}>{fmtP(rec.levels.tp2)}</div>
                <div style={{fontSize:12,color:'#888'}}>+{rec.levels.tp2Pct}% · close rest</div>
              </div>
            )}
          </div>

          {/* Confidence bar */}
          <div style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#666',marginBottom:4}}>
              <span>Confidence: <strong style={{color:confColor}}>{rec.confidence}%</strong> ({rec.layers}/5 layers aligned)</span>
              <span style={{color:'#888'}}>Layers: Macro · ETF · Weekly · Daily · 4h</span>
            </div>
            <div style={{height:10,background:'rgba(0,0,0,0.1)',borderRadius:5,overflow:'hidden'}}>
              <div style={{height:'100%',width:(rec.confidence||0)+'%',background:confColor,borderRadius:5}}/>
            </div>
          </div>

          {/* Plans */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div style={{background:'rgba(0,0,0,0.04)',borderRadius:8,padding:'8px 12px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#666',marginBottom:3}}>☀️ Daily plan</div>
              <div style={{fontSize:13}}>{rec.dailyPlan}</div>
            </div>
            <div style={{background:'rgba(0,0,0,0.04)',borderRadius:8,padding:'8px 12px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#666',marginBottom:3}}>📅 Weekly plan</div>
              <div style={{fontSize:13}}>{rec.weeklyPlan}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:'#888'}}>⚠️ Educational only · Not financial advice · Always use stop-loss · Risk max 1-2% per trade</div>
        </div>

        {/* Analysis grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1rem'}}>

          {/* ── LAYER 1: MACRO ── */}
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700}}>🌍 Layer 1 — Macro trend</div>
              <Badge sig={macroAsBadge}/>
            </div>
            {md&&Object.entries(md).map(([sym,d])=>{
              const labels={'^DJI':'Dow Jones','^IXIC':'Nasdaq','GC=F':'Gold','CL=F':'Oil','DX-Y.NYB':'USD Index','^TNX':'US 10Y Yield'};
              if(!d?.analysis)return null;
              return(
                <div key={sym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid #f5f3f0',fontSize:12}}>
                  <div>
                    <div style={{fontWeight:500}}>{labels[sym]||sym}</div>
                    <div style={{color:d.chgPct>=0?'#27500A':'#A32D2D',fontSize:11}}>{d.price>100?'$'+Math.round(d.price).toLocaleString():d.price?.toFixed(3)} {d.chgPct>=0?'+':''}{d.chgPct?.toFixed(2)}%</div>
                  </div>
                  <Badge sig={d.analysis.overall}/>
                </div>
              );
            })}
            <div style={{marginTop:8,fontSize:11,color:'#888',padding:'4px 8px',background:'#f8f7f4',borderRadius:6}}>
              Trend: <strong>{macroSig}</strong> · Score: {rec.macroTrend?.pct>0?'+':''}{rec.macroTrend?.pct}%
            </div>
          </div>

          {/* ── LAYER 1.5: ETF FLOWS ── */}
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700}}>🏦 Layer 1.5 — BTC ETF flows</div>
              {etf&&<Badge sig={etf.signal}/>}
            </div>
            {etf?.flows&&Object.entries(etf.flows).map(([ticker,f])=>(
              <div key={ticker} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid #f5f3f0',fontSize:12}}>
                <div>
                  <div style={{fontWeight:500}}>{ticker} <span style={{color:'#aaa',fontSize:11}}>{f.name}</span></div>
                  <div style={{color:f.chgPct>=0?'#27500A':'#A32D2D',fontSize:11}}>${f.price?.toFixed(2)} {f.chgPct>=0?'+':''}{f.chgPct?.toFixed(2)}%</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,fontWeight:600,color:f.flow1d>=0?'#27500A':'#A32D2D'}}>{fmtM(f.flow1d||0)}</div>
                  <div style={{fontSize:10,color:'#aaa'}}>est. flow</div>
                </div>
              </div>
            ))}
            <div style={{marginTop:8,fontSize:11,color:'#888',padding:'4px 8px',background:'#f8f7f4',borderRadius:6}}>
              Net flow: <strong style={{color:(etf?.netFlow1d||0)>=0?'#27500A':'#A32D2D'}}>{fmtM(etf?.netFlow1d||0)}/day</strong> · Signal: <strong>{etf?.signal}</strong>
            </div>
          </div>
        </div>

        {/* ── LAYER 2: TECHNICAL ── */}
        <div style={card}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>📊 Layer 2 — Technical signals (5 indicators per timeframe)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
            {['1w','1d','4h','1h'].map(tf=>(
              <div key={tf} style={{background:'#faf9f7',borderRadius:10,padding:'10px 12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#444'}}>{tf==='1w'?'Weekly':tf==='1d'?'Daily':tf==='4h'?'4 hour':'1 hour'}</span>
                  <Badge sig={rec.timeframes[tf]}/>
                </div>
                {rec.indicators[tf]&&Object.entries({
                  'MA':rec.indicators[tf].maSig,
                  ['RSI '+(rec.rsi?.[tf]||'')]:rec.indicators[tf].rsiSig,
                  'MACD':rec.indicators[tf].macdSig,
                  'S/R':rec.indicators[tf].srSig,
                  'Vol':rec.indicators[tf].volSig,
                }).map(([l,sig])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 0',fontSize:11}}>
                    <span style={{color:'#888'}}>{l}</span>
                    <Badge sig={sig||'NEUTRAL'}/>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Alert log */}
        {log.length>0&&(
          <div style={card}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>🔔 Signal changes this session</div>
            {log.map((a,i)=>(
              <div key={i} style={{display:'flex',gap:8,fontSize:12,padding:'4px 0',borderBottom:'0.5px solid #f0ede8'}}>
                <span style={{color:'#aaa'}}>{a.ts}</span>
                <strong>{a.coin}</strong>
                <span style={{color:'#666'}}>{a.from} → {a.to}</span>
                <span style={{marginLeft:'auto',color:'#888'}}>{a.conf}%</span>
              </div>
            ))}
          </div>
        )}

        <div style={{textAlign:'center',fontSize:11,color:'#aaa',marginTop:8,paddingBottom:'2rem'}}>
          Updated: {upd} · Auto-refresh 60s · Not financial advice
        </div>
      </>}
    </div>
    </div>
  );
}
