import { useState, useEffect, useCallback } from 'react';

const COINS = [{ sym: 'BTCUSDT', label: 'BTC' }, { sym: 'ETHUSDT', label: 'ETH' }, { sym: 'SOLUSDT', label: 'SOL' }, { sym: 'BNBUSDT', label: 'BNB' }];
const fmtP = p => p > 100 ? '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '$' + parseFloat(p || 0).toFixed(2);
const fmtM = m => (m >= 0 ? '+$' : '-$') + Math.abs(m || 0).toFixed(1) + 'M';

function Badge({ sig }) {
  const map = { 'STRONG BUY': { bg: '#3B6D11', c: '#EAF3DE', t: '▲▲ Strong buy' }, 'BUY': { bg: '#EAF3DE', c: '#27500A', t: '▲ Buy' }, 'NEUTRAL': { bg: '#F1EFE8', c: '#444441', t: '— Neutral' }, 'SELL': { bg: '#FCEBEB', c: '#791F1F', t: '▼ Sell' }, 'STRONG SELL': { bg: '#A32D2D', c: '#FCEBEB', t: '▼▼ Strong sell' } };
  const s = map[sig] || map['NEUTRAL'];
  return <span style={{ background: s.bg, color: s.c, borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.t}</span>;
}

export default function Dashboard() {
  const [coin, setCoin] = useState(COINS[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upd, setUpd] = useState('');
  const [tgStatus, setTgStatus] = useState('');
  const [etfDetail, setEtfDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/recommendation?coin=' + coin.sym + '&label=' + coin.label + '&_=' + Date.now());
      const j = await r.json();
      if (j.error) { console.error(j.error); return; }
      setData(j); setUpd(new Date().toLocaleTimeString());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [coin]);

  useEffect(() => { setLoading(true); setData(null); load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  // Full ETF detail (daily series + cumulative) from /api/etf — covers all assets.
  useEffect(() => {
    const fetchEtf = () => fetch('/api/etf').then(r => r.json()).then(setEtfDetail).catch(() => {});
    fetchEtf();
    const t = setInterval(fetchEtf, 60000);
    return () => clearInterval(t);
  }, []);

  const sendTg = async () => {
    if (!data?.rec) return; setTgStatus('Sending...');
    try {
      const rec = data.rec;
      const msg = coin.label + ' — ' + rec.action + '\nNow: ' + fmtP(rec.currentPrice) + (rec.levels.hasLevels ? ('\nEntry: ' + fmtP(rec.entryPrice) + '\nSL: ' + fmtP(rec.levels.sl) + '\nTP1: ' + fmtP(rec.levels.tp1)) : '') + '\nETF(10d): ' + fmtM(rec.etf.net10d) + '\nMacro: ' + rec.macroTrend.trend;
      const r = await fetch('/api/telegram/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
      const j = await r.json(); setTgStatus(j.ok ? 'Sent!' : 'Failed');
    } catch { setTgStatus('Error'); }
    setTimeout(() => setTgStatus(''), 3000);
  };

  const rec = data?.rec, md = data?.macroData, etf = rec?.etf;
  const ed = etfDetail?.assets?.[coin.label]; // { daily, labels, total, funds }
  const etfLive = etfDetail?.live;
  const isBuy = rec?.actionShort === 'BUY', isSell = rec?.actionShort === 'SELL';
  const isWait = rec?.actionShort?.startsWith('WAIT');
  const bg = isBuy ? '#EAF3DE' : isSell ? '#FCEBEB' : isWait ? '#FAEEDA' : '#F1EFE8';
  const bdr = isBuy ? '3px solid #3B6D11' : isSell ? '3px solid #A32D2D' : isWait ? '2px solid #BA7517' : '2px solid #B4B2A9';
  const tc = isBuy ? '#1A4A06' : isSell ? '#6B1010' : isWait ? '#5C3200' : '#333';
  const cc = (rec?.confidence || 0) >= 80 ? '#3B6D11' : (rec?.confidence || 0) >= 60 ? '#BA7517' : '#A32D2D';
  const ms = rec?.macroTrend?.trend;
  const mb = (ms === 'BULL' || ms === 'MILD BULL') ? 'BUY' : (ms === 'BEAR' || ms === 'MILD BEAR') ? 'SELL' : 'NEUTRAL';
  const card = { background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 14, padding: '0.9rem', marginBottom: '0.85rem' };
  const ML = { '^DJI': 'Dow Jones', '^IXIC': 'Nasdaq', 'GC=F': 'Gold', 'CL=F': 'Oil', 'DX-Y.NYB': 'USD Index', '^TNX': 'US 10Y Yield' };
  const autoGrid = (min) => ({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(' + min + 'px,1fr))', gap: 8 });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f1', fontFamily: 'system-ui,sans-serif', padding: '0.75rem' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>CryptoRadar</h1>
            <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Macro + ETF + Technical → view (not a guarantee)</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COINS.map(c => <button key={c.sym} onClick={() => setCoin(c)} style={{ padding: '6px 14px', borderRadius: 8, border: '0.5px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: coin.sym === c.sym ? '#534AB7' : '#fff', color: coin.sym === c.sym ? '#fff' : '#333', borderColor: coin.sym === c.sym ? '#534AB7' : '#ddd' }}>{c.label}</button>)}
            <button onClick={load} style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid #ddd', cursor: 'pointer', fontSize: 13, background: '#fff' }}>↻</button>
            <button onClick={sendTg} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: '#0088cc', color: '#fff', fontWeight: 600 }}>{tgStatus || '📱'}</button>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Loading market data...</div>}

        {!loading && rec && <>

          {/* PREDICTION / CONCLUSION — always shows */}
          <div style={{ background: bg, border: bdr, borderRadius: 16, padding: '1.1rem', marginBottom: '0.85rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#777', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>{coin.label} — conclusion</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: tc, marginBottom: 4 }}>{rec.action}</div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>{rec.entryNote}</div>

            <div style={autoGrid(120)}>
              <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ fontSize: 11, color: '#555' }}>Current price (live)</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtP(rec.currentPrice)}</div>
                <div style={{ fontSize: 12, color: rec.chgPct >= 0 ? '#27500A' : '#A32D2D' }}>{rec.chgPct >= 0 ? '+' : ''}{(rec.chgPct || 0).toFixed(2)}% (1h)</div>
              </div>
              {rec.levels.hasLevels ? <>
                <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 11, color: '#555' }}>📍 Entry / action price</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtP(rec.entryPrice)}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{rec.actionShort === 'WAIT_BUY' && rec.entryPrice < rec.currentPrice ? 'limit buy below market' : 'at market'}</div>
                </div>
                <div style={{ background: 'rgba(163,45,45,0.1)', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 11, color: '#555' }}>🛑 Stop loss</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#A32D2D' }}>{fmtP(rec.levels.sl)}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>-{rec.levels.slPct}% from entry</div>
                </div>
                <div style={{ background: 'rgba(59,109,17,0.08)', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 11, color: '#555' }}>✅ TP1 / 🎯 TP2</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#27500A' }}>{fmtP(rec.levels.tp1)} / {fmtP(rec.levels.tp2)}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>+{rec.levels.tp1Pct}% / +{rec.levels.tp2Pct}%</div>
                </div>
              </> : <div style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: '9px 12px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>Why no entry/stop/target yet</div>
                <div style={{ fontSize: 13 }}>⏳ Waiting for: <strong>{rec.waitingFor}</strong></div>
                <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>Current lean: <strong>{rec.bias}</strong></div>
              </div>}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                <span>Signal strength: <strong style={{ color: cc }}>{rec.layers}/5 layers agree</strong> ({rec.confidence}%)</span>
                <span style={{ color: '#999' }}>not a win-probability</span>
              </div>
              <div style={{ height: 9, background: 'rgba(0,0,0,0.1)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (rec.confidence || 0) + '%', background: cc, borderRadius: 5 }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>⚠️ Educational only · not financial advice · risk max 1-2% per trade</div>
          </div>

          {/* Layers: macro + ETF side by side, stack on mobile */}
          <div style={autoGrid(260)}>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🌍 Macro trend</div><Badge sig={mb} />
              </div>
              {md && Object.entries(md).map(([s, d]) => d?.analysis ? (
                <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid #f5f3f0', fontSize: 12 }}>
                  <div><div style={{ fontWeight: 500 }}>{ML[s] || s}</div>
                    <div style={{ color: d.chgPct >= 0 ? '#27500A' : '#A32D2D', fontSize: 11 }}>{d.price > 100 ? '$' + Math.round(d.price).toLocaleString() : d.price?.toFixed(3)} {d.chgPct >= 0 ? '+' : ''}{d.chgPct?.toFixed(2)}%</div></div>
                  <Badge sig={d.analysis.overall} />
                </div>) : null)}
              <div style={{ marginTop: 8, fontSize: 11, color: '#666', padding: '5px 8px', background: '#f8f7f4', borderRadius: 6 }}>Trend: <strong>{ms}</strong> ({(rec.macroTrend?.pct || 0) > 0 ? '+' : ''}{rec.macroTrend?.pct || 0}%)</div>
            </div>

            {/* ETF flows — per-asset, live via Farside; detail from /api/etf */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>🏦 {coin.label} ETF flows</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{(etfLive ?? etf?.live) ? 'Live · Farside' : 'Snapshot · Farside'}</div></div>
                {etf && <Badge sig={etf.signal} />}
              </div>
              {etf?.hasEtf ? <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid #f5f3f0', fontSize: 13 }}>
                  <span style={{ color: '#666' }}>Latest day{etf.lastDate ? ' (' + etf.lastDate + ')' : ''}</span><strong style={{ color: etf.last1d >= 0 ? '#27500A' : '#A32D2D' }}>{fmtM(etf.last1d)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid #f5f3f0', fontSize: 13 }}>
                  <span style={{ color: '#666' }}>10-day net</span><strong style={{ color: etf.net10d >= 0 ? '#27500A' : '#A32D2D' }}>{fmtM(etf.net10d)}</strong>
                </div>
                {ed && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid #f5f3f0', fontSize: 13 }}>
                  <span style={{ color: '#666' }}>Cumulative since launch</span><strong>${(ed.total / 1000).toFixed(1)}B</strong>
                </div>}

                {/* Compact daily bar chart (zero-baseline, green up / red down) */}
                {ed && ed.daily?.length ? (() => {
                  const maxAbs = Math.max(...ed.daily.map(v => Math.abs(v)), 1);
                  return (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Daily net flow — last {ed.daily.length} days (US$m)</div>
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, height: 46 }}>
                        {ed.daily.map((v, i) => {
                          const h = (Math.abs(v) / maxAbs) * 20;
                          const pos = v >= 0;
                          return (
                            <div key={i} title={ed.labels[i] + ': ' + fmtM(v)} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                                {pos && <div style={{ width: '100%', height: h, background: '#3B6D11', borderRadius: '2px 2px 0 0' }} />}
                              </div>
                              <div style={{ height: 1, background: '#ddd' }} />
                              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                                {!pos && <div style={{ width: '100%', height: h, background: '#A32D2D', borderRadius: '0 0 2px 2px' }} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#aaa', marginTop: 2 }}>
                        <span>{ed.labels[0]}</span><span>{ed.labels[ed.labels.length - 1]}</span>
                      </div>
                    </div>
                  );
                })() : null}

                <div style={{ marginTop: 8, fontSize: 11, color: '#666', padding: '5px 8px', background: '#f8f7f4', borderRadius: 6 }}>
                  {etf.net10d > 100 ? 'Inflows → bullish' : etf.net10d < -100 ? 'Outflows → bearish' : 'Flat → neutral'} · {etf.funds}
                </div>
                <a href="/etf" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#534AB7', textDecoration: 'none' }}>View full ETF page →</a>
              </> : <div style={{ fontSize: 12, color: '#888', padding: '12px 4px' }}>No US spot ETF for {coin.label} yet — this layer is N/A.</div>}
            </div>
          </div>

          {/* Technical: 4 timeframes, wraps on mobile */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📊 Technical (5 indicators · 4 timeframes)</div>
            <div style={autoGrid(150)}>
              {['1w', '1d', '4h', '1h'].map(tf => (
                <div key={tf} style={{ background: '#faf9f7', borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{tf === '1w' ? 'Weekly' : tf === '1d' ? 'Daily' : tf}</span><Badge sig={rec.timeframes[tf]} />
                  </div>
                  {rec.indicators[tf] && Object.keys(rec.indicators[tf]).length ? (() => {
                    const ind = rec.indicators[tf];
                    const rows = [['MA', ind.maSig], ['RSI ' + (rec.rsi?.[tf] || ''), ind.rsiSig], ['MACD', ind.macdSig], ['S/R', ind.srSig], ['Vol', ind.volSig]];
                    return rows.map(([l, sig]) => (
                      <div key={l} style={{ padding: '2px 0', fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#777' }}>{l}</span><Badge sig={sig || 'NEUTRAL'} />
                        </div>
                        {l === 'Vol' && ind.volBuyPct != null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, overflow: 'hidden', display: 'flex', background: '#eee' }}>
                              <div style={{ width: ind.volBuyPct + '%', background: '#3B6D11' }} />
                              <div style={{ width: (100 - ind.volBuyPct) + '%', background: '#A32D2D' }} />
                            </div>
                            <span style={{ fontSize: 9, color: '#27500A', fontWeight: 600 }}>B{Math.round(ind.volBuyPct)}</span>
                            <span style={{ fontSize: 9, color: '#A32D2D', fontWeight: 600 }}>S{Math.round(100 - ind.volBuyPct)}</span>
                            <span style={{ fontSize: 9, color: '#aaa' }}>est.</span>
                          </div>
                        )}
                      </div>
                    ));
                  })() : <div style={{ fontSize: 11, color: '#aaa' }}>(weekly/daily only)</div>}
                </div>))}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', padding: '6px 0 2rem' }}>Updated: {upd} · auto-refresh 60s · prices live (Yahoo) · ETF flows {etf?.live ? 'live' : '= ' + (etf?.lastDate || '12 Jun') + ' snapshot'}</div>
        </>}
      </div>
    </div>
  );
}
