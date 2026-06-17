import { useState } from 'react';
import useSWR from 'swr';

const REFRESH = Number(process.env.NEXT_PUBLIC_REFRESH_INTERVAL) || 60000;
const fetcher = (url) => fetch(url).then((r) => r.json());

const fmtM = (m) => (m >= 0 ? '+$' : '-$') + Math.abs(m).toFixed(1) + 'M';
const fmtB = (m) => '$' + (m / 1000).toFixed(1) + 'B';

export default function EtfPage() {
  const [asset, setAsset] = useState('BTC');
  const { data, error, isLoading } = useSWR('/api/etf', fetcher, {
    refreshInterval: REFRESH,
    revalidateOnFocus: false,
  });

  const wrap = (children) => (
    <div style={{ minHeight: '100vh', background: '#f5f4f1', fontFamily: 'system-ui,sans-serif', padding: '1rem' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>{children}</div>
    </div>
  );

  if (isLoading && !data) return wrap(<p style={{ color: '#888', fontSize: 14 }}>Loading ETF flows…</p>);
  if (error || !data || data.error || !data.assets)
    return wrap(<p style={{ color: '#A32D2D', fontSize: 14 }}>Couldn’t load ETF flows. Retrying…</p>);

  const a = data.assets[asset];
  const d = a.daily;
  const labels = a.labels;
  const asOf = data.asOf;
  const isLive = data.live;

  const latest = d[d.length - 1];
  const tenDay = d.slice(-10).reduce((x, y) => x + y, 0);
  const maxAbs = Math.max(...d.map((v) => Math.abs(v)), 1);
  const trend = tenDay > 100 ? 'Net inflow — institutions buying' : tenDay < -100 ? 'Net outflow — institutions selling' : 'Flat / mixed — no strong signal';
  const trendColor = tenDay > 100 ? '#27500A' : tenDay < -100 ? '#A32D2D' : '#5C3200';

  return wrap(
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>ETF Cash Flow</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            Spot-ETF daily net flows · Source: Farside Investors
            <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: isLive ? '#EAF3DE' : '#FAEEDA', color: isLive ? '#27500A' : '#854F0B' }}>
              {isLive ? '● Live' : 'Snapshot'}
            </span>
          </p>
        </div>
        <a href="/" style={{ fontSize: 13, color: '#534AB7', textDecoration: 'none' }}>← Back to dashboard</a>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        {['BTC', 'ETH', 'SOL'].map((x) => (
          <button key={x} onClick={() => setAsset(x)} style={{ padding: '8px 22px', borderRadius: 8, border: '0.5px solid', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: asset === x ? '#534AB7' : '#fff', color: asset === x ? '#fff' : '#333', borderColor: asset === x ? '#534AB7' : '#ddd' }}>{x}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.25rem' }}>
        <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Latest day ({asOf})</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: latest >= 0 ? '#27500A' : '#A32D2D' }}>{fmtM(latest)}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>10-day net</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: tenDay >= 0 ? '#27500A' : '#A32D2D' }}>{fmtM(tenDay)}</div>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Cumulative since launch</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtB(a.total)}</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #e0ddd8', borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Daily net flow — last {d.length} trading days (US$m)</div>
        {d.map((v, i) => {
          const pct = (Math.abs(v) / maxAbs) * 100;
          const pos = v >= 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0' }}>
              <span style={{ fontSize: 11, color: '#888', width: 54, flexShrink: 0 }}>{labels[i]}</span>
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
          Inflows = institutions putting real money into {asset} via regulated ETFs (bullish pressure). Outflows = money leaving (bearish). Funds tracked: {a.funds}.
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', paddingBottom: '2rem' }}>
        Source: Farside Investors · {isLive ? `live, refreshes every ${Math.round(REFRESH / 1000)}s` : 'snapshot fallback (live source unavailable)'} · as of {asOf} · Educational only, not financial advice!!!
      </div>
    </>
  );
}
