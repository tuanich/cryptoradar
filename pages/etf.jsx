import { useState } from 'react';

const SNAPSHOT_DATE = '12 Jun 2026';
const LABELS = ['26 May','27 May','28 May','29 May','01 Jun','02 Jun','03 Jun','04 Jun','05 Jun','08 Jun','09 Jun','10 Jun','11 Jun','12 Jun'];
const FLOWS = {
  BTC: { daily: [-333.6,-733.4,-223.3,-125.3,-483.8,-519.1,-396.6,3.2,-325.7,-91.4,-77.4,-213.9,-22.5,85.9], total: 53673, funds: 'IBIT, FBTC, BITB, ARKB, GBTC + others' },
  ETH: { daily: [-35.1,-67.1,-121.4,-18.0,-44.5,-90.2,-53.0,19.3,-6.0,82.4,-40.9,-35.5,-15.9,-4.9], total: 11215, funds: 'ETHA, FETH, ETHE + others' },
  SOL: { daily: [0.0,0.6,0.5,1.3,0.0,6.5,-12.8,0.0,0.0,-0.5,0.8,0.0,-4.4,0.0], total: 1118, funds: 'BSOL, FSOL, GSOL + others' },
};
const fmtM = m => (m >= 0 ? '+$' : '-$') + Math.abs(m).toFixed(1) + 'M';
const fmtB = m => '$' + (m / 1000).toFixed(1) + 'B';

export default function EtfPage() {
  const [asset, setAsset] = useState('BTC');
  const d = FLOWS[asset].daily;
  const latest = d[d.length - 1];
  const tenDay = d.slice(-10).reduce((a, b) => a + b, 0);
  const maxAbs = Math.max(...d.map(v => Math.abs(v)), 1);
  const trend = tenDay > 100 ? 'Net inflow — institutions buying' : tenDay < -100 ? 'Net outflow — institutions selling' : 'Flat / mixed — no strong signal';
  const trendColor = tenDay > 100 ? '#27500A' : tenDay < -100 ? '#A32D2D' : '#5C3200';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f1', fontFamily: 'system-ui,sans-serif', padding: '1rem' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>ETF Cash Flow</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Real spot-ETF daily net flows · Source: Farside Investors</p>
          </div>
          <a href="/" style={{ fontSize: 13, color: '#534AB7', textDecoration: 'none' }}>← Back to dashboard</a>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {['BTC', 'ETH', 'SOL'].map(a => (
            <button key={a} onClick={() => setAsset(a)} style={{ padding: '8px 22px', borderRadius: 8, border: '0.5px solid', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: asset === a ? '#534AB7' : '#fff', color: asset === a ? '#fff' : '#333', borderColor: asset === a ? '#534AB7' : '#ddd' }}>{a}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.25rem' }}>
          <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Latest day ({SNAPSHOT_DATE})</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: latest >= 0 ? '#27500A' : '#A32D2D' }}>{fmtM(latest)}</div>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>10-day net</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: tenDay >= 0 ? '#27500A' : '#A32D2D' }}>{fmtM(tenDay)}</div>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Cumulative since launch</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtB(FLOWS[asset].total)}</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Daily net flow — last 14 trading days (US$m)</div>
          {d.map((v, i) => {
            const pct = (Math.abs(v) / maxAbs) * 100;
            const pos = v >= 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0' }}>
                <span style={{ fontSize: 11, color: '#888', width: 54, flexShrink: 0 }}>{LABELS[i]}</span>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', height: 18 }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#ddd' }} />
                  <div style={{ position: 'absolute', left: pos ? '50%' : 'auto', right: pos ? 'auto' : '50%', height: 14, width: pct / 2 + '%', background: pos ? '#3B6D11' : '#A32D2D', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: pos ? '#27500A' : '#A32D2D', width: 64, textAlign: 'right', flexShrink: 0 }}>{fmtM(v)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ background: tenDay >= 0 ? '#EAF3DE' : '#FCEBEB', border: tenDay >= 0 ? '2px solid #3B6D11' : '2px solid #A32D2D', borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>What this means for {asset}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: trendColor, marginBottom: 8 }}>{trend}</div>
          <div style={{ fontSize: 13, color: '#555' }}>
            Inflows = institutions putting real money into {asset} via regulated ETFs (bullish pressure). Outflows = money leaving (bearish). Funds tracked: {FLOWS[asset].funds}.
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', paddingBottom: '2rem' }}>
          Source: Farside Investors · snapshot as of {SNAPSHOT_DATE} (not a live feed) · Educational only, not financial advice
        </div>
      </div>
    </div>
  );
}
