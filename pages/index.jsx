import{useState,useEffect,useCallback}from'react';
const COINS=[{sym:'BTCUSDT',label:'BTC'},{sym:'ETHUSDT',label:'ETH'},{sym:'SOLUSDT',label:'SOL'},{sym:'BNBUSDT',label:'BNB'}];
const MACRO_LABELS={'^DJI':'Dow Jones','^IXIC':'Nasdaq','GC=F':'Gold','CL=F':'Oil','DX-Y.NYB':'USD Index','^TNX':'US 10Y Yield'};
function sigBadge(sig){
  const m={'STRONG BUY':{bg:'#3B6D11',c:'#EAF3DE',l:'▲▲ Strong buy'},'BUY':{bg:'#EAF3DE',c:'#27500A',l:'▲ Buy'},'NEUTRAL':{bg:'#F1EFE8',c:'#444441',l:'— Neutral'},'SELL':{bg:'#FCEBEB',c:'#791F1F',l:'▼ Sell'},'STRONG SELL':{bg:'#A32D2D',c:'#FCEBEB',l:'▼▼ Strong sell'}};
  const s=m[sig]||m['NEUTRAL'];
  return <span style={{background:s.bg,color:s.c,borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:500}}>{s.l}</span>;
}
function acCls(short){
  if(short==='BUY')return{bg:'#EAF3DE',border:'2px solid #3B6D11'};
  if(short==='SELL')return{bg:'#FCEBEB',border:'2px solid #A32D2D'};
  if(short?.startsWith('WAIT'))return{bg:'#FAEEDA',border:'1.5px solid #BA7517'};
  return{bg:'#F1EFE8',border:'1.5px solid #B4B2A9'};
}
function fmtP(p){return p>1000?'$'+Math.round(p).toLocaleString():'$'+(p||0).toFixed(4);}
export default function Dashboard(){
  const[coin,setCoin]=useState(COINS[0]);
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[upd,setUpd]=useState('');
  const[log,setLog]=useState([]);
  const[tgStatus,setTgStatus]=useState('');
  const fetch_=useCallback(async()=>{
    try{
      const r=await fetch('/api/recommendation?coin='+coin.sym+'&label='+coin.label);
      const j=await r.json();
      setData(prev=>{
        if(prev?.rec?.actionShort&&prev.rec.actionShort!==j.rec?.actionShort)
          setLog(l=>[{ts:new Date().toLocaleTimeString(),coin:coin.label,from:prev.rec.actionShort,to:j.rec.actionShort,conf:j.rec.confidence},...l.slice(0,19)]);
        return j;
      });
      setUpd(new Date().toLocaleTimeString());
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[coin]);
  useEffect(()=>{setLoading(true);fetch_();},[fetch_]);
  useEffect(()=>{const t=setInterval(fetch_,60000);return()=>clearInterval(t);},[fetch_]);
  const sendTg=async()=>{
    if(!data?.rec)return;setTgStatus('Sending...');
    try{const r=await fetch('/api/telegram/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:coin.label+' — '+data.rec.action+' ('+data.rec.confidence+'%)'})});const j=await r.json();setTgStatus(j.ok?'✓ Sent!':'✗ Failed');}
    catch{setTgStatus('✗ Error');}
    setTimeout(()=>setTgStatus(''),3000);
  };
  const rec=data?.rec,md=data?.macroData,mt=data?.macroTrend,ac=rec?acCls(rec.actionShort):{};
  return(<div style={{minHeight:'100vh',background:'#f8f7f4',fontFamily:'system-ui,sans-serif',padding:'1rem'}}>
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
        <div><h1 style={{margin:0,fontSize:20,fontWeight:600}}>CryptoRadar</h1><p style={{margin:0,fontSize:12,color:'#888'}}>Macro + Technical → Signal Dashboard</p></div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {COINS.map(c=><button key={c.sym} onClick={()=>setCoin(c)} style={{padding:'5px 14px',borderRadius:8,border:'0.5px solid',cursor:'pointer',fontSize:13,fontWeight:500,background:coin.sym===c.sym?'#534AB7':'#fff',color:coin.sym===c.sym?'#fff':'#333',borderColor:coin.sym===c.sym?'#534AB7':'#ddd'}}>{c.label}</button>)}
          <button onClick={fetch_} style={{padding:'5px 12px',borderRadius:8,border:'0.5px solid #ddd',cursor:'pointer',fontSize:13,background:'#fff'}}>↻ Refresh</button>
          <button onClick={sendTg} style={{padding:'5px 12px',borderRadius:8,border:'0.5px solid #ddd',cursor:'pointer',fontSize:13,background:'#fff'}}>📱 {tgStatus||'Telegram'}</button>
        </div>
      </div>
      {loading&&<div style={{textAlign:'center',padding:'3rem',color:'#888'}}>Loading market data...</div>}
      {!loading&&rec&&<>
        <div style={{...ac,borderRadius:12,padding:'1.25rem',textAlign:'center',marginBottom:'.75rem'}}>
          <div style={{fontSize:24,fontWeight:600,marginBottom:6}}>{rec.action}</div>
          <div style={{fontSize:13,color:'#666',marginBottom:10}}>{rec.dailyPlan}</div>
          <div style={{fontSize:13}}>Confidence: <strong>{rec.confidence}%</strong> ({rec.layers}/5 layers)
            <div style={{height:8,background:'#fff',borderRadius:4,overflow:'hidden',maxWidth:300,margin:'6px auto 0'}}>
              <div style={{height:'100%',width:rec.confidence+'%',background:rec.confidence>=80?'#3B6D11':rec.confidence>=60?'#BA7517':'#A32D2D',borderRadius:4}}/>
            </div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:'.75rem'}}>
          {[{l:'Price',v:fmtP(rec.price)},{l:'1h change',v:(rec.chgPct>=0?'+':'')+rec.chgPct.toFixed(2)+'%',c:rec.chgPct>=0?'#3B6D11':'#A32D2D'},{l:'Macro',v:mt?.trend||'—'},{l:'Weekly',v:rec.timeframes['1w']},{l:'Daily',v:rec.timeframes['1d']},{l:'4h',v:rec.timeframes['4h']},{l:'1h',v:rec.timeframes['1h']}].map(i=>(
            <div key={i.l} style={{background:'#f0ede8',borderRadius:8,padding:'.625rem .875rem'}}>
              <div style={{fontSize:11,color:'#888',marginBottom:3}}>{i.l}</div>
              <div style={{fontSize:14,fontWeight:500,color:i.c||'#222'}}>{i.v}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#fff',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'1rem',marginBottom:'.75rem'}}>
          <div style={{fontSize:12,fontWeight:500,color:'#888',marginBottom:8}}>Step 1 — Macro trend (global economy)</div>
          {md&&Object.entries(md).map(([sym,d])=>(
            <div key={sym} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.5px solid #f0ede8',fontSize:12}}>
              <span style={{color:'#888',minWidth:100}}>{MACRO_LABELS[sym]||sym}</span>
              <span style={{flex:1,color:'#888',fontSize:11}}>{d.price>100?'$'+Math.round(d.price).toLocaleString():d.price?.toFixed(3)}<span style={{marginLeft:6,color:d.chgPct>=0?'#3B6D11':'#A32D2D'}}>{d.chgPct>=0?'+':''}{d.chgPct?.toFixed(2)}%</span></span>
              {d.analysis&&sigBadge(d.analysis.overall)}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem',marginBottom:'.75rem'}}>
          {['4h','1h'].map(tf=>(
            <div key={tf} style={{background:'#fff',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'1rem'}}>
              <div style={{fontSize:12,fontWeight:500,color:'#888',marginBottom:8}}>{tf} indicators · {sigBadge(rec.timeframes[tf])}</div>
              {rec.indicators[tf]&&Object.entries({'MA':rec.indicators[tf].maSig,['RSI ('+rec.rsi?.[tf]+')']:rec.indicators[tf].rsiSig,'MACD':rec.indicators[tf].macdSig,'S/R':rec.indicators[tf].srSig,'Volume':rec.indicators[tf].volSig}).map(([l,s])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'0.5px solid #f5f5f5',fontSize:12}}>
                  <span style={{color:'#888'}}>{l}</span>{sigBadge(s)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{background:'#fff',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'1rem',marginBottom:'.75rem'}}>
          <div style={{fontSize:12,fontWeight:500,color:'#888',marginBottom:8}}>Risk management levels</div>
          {[{l:'Current price',v:fmtP(rec.levels.price)},{l:'Stop loss (-'+rec.levels.slPct+'%)',v:fmtP(rec.levels.sl),c:'#A32D2D'},{l:'Take profit 1 (+'+rec.levels.tp1Pct+'%)',v:fmtP(rec.levels.tp1),c:'#3B6D11'},{l:'Take profit 2 (+'+rec.levels.tp2Pct+'%)',v:fmtP(rec.levels.tp2),c:'#3B6D11'},{l:'Weekly support',v:fmtP(rec.levels.support)},{l:'Weekly resistance',v:fmtP(rec.levels.resistance)}].map(r=>(
            <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid #f5f5f5',fontSize:12}}>
              <span style={{color:'#888'}}>{r.l}</span><span style={{fontWeight:500,color:r.c||'#222'}}>{r.v}</span>
            </div>
          ))}
        </div>
        <div style={{background:'#fff',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'1rem'}}>
          <div style={{fontSize:12,fontWeight:500,color:'#888',marginBottom:8}}>Alert log</div>
          {!log.length?<div style={{fontSize:12,color:'#aaa',textAlign:'center',padding:'.75rem'}}>No signal changes yet.</div>
            :log.map((a,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid #f5f5f5',fontSize:12}}>
              <span style={{color:'#aaa',minWidth:60}}>{a.ts}</span><span style={{fontWeight:500}}>{a.coin}</span>
              <span style={{color:'#888'}}>{a.from} → {a.to}</span><span style={{marginLeft:'auto',color:'#888'}}>{a.conf}%</span>
            </div>)}
        </div>
        <div style={{textAlign:'center',fontSize:11,color:'#aaa',marginTop:12}}>Updated: {upd} · Auto-refresh 60s · Educational only</div>
      </>}
    </div>
  </div>);
}