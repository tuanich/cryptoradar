import { getEtfFlows } from '../../lib/etfProvider';

// Module-scoped cache survives across requests on a warm serverless instance.
// Flows update at most daily, so a few minutes is plenty and keeps us well
// under CoinGlass rate limits even with many clients polling every 60s.
const TTL_MS = 5 * 60 * 1000;
let cache = { data: null, ts: 0 };

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!cache.data || now - cache.ts > TTL_MS) {
      cache = { data: await getEtfFlows(), ts: now };
    }

    // Let Vercel's CDN cache it too: serve cached for 5 min, allow stale for 10 more.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(cache.data);
  } catch (err) {
    console.error('[api/etf] handler error:', err.message);
    res.status(500).json({ error: 'Failed to load ETF flows' });
  }
}
