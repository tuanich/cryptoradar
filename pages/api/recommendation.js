import { fetchMacroData, calcMacroTrend } from '../../lib/macroEngine';
import { fetchAllTimeframes, buildRecommendation } from '../../lib/recommendation';
const cache = new Map();
const CACHE_TTL = 60000;
export default async function handler(req, res) {
  const { coin='BTCUSDT', label='BTC' } = req.query;
  const cacheKey = 'rec_'+coin;
  const cached = cache.get(cacheKey);
  if (cached && Date.now()-cached.ts < CACHE_TTL) return res.status(200).json(cached.data);
  try {
    const [macroData, tfs] = await Promise.all([fetchMacroData(), fetchAllTimeframes(coin)]);
    const macroTrend = calcMacroTrend(macroData);
    const rec = buildRecommendation(macroTrend, tfs, label);
    const result = { rec, macroData, macroTrend };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    res.status(200).json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
}