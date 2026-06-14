import { fetchMacroData, calcMacroTrend } from '../../../lib/macroEngine';
import { fetchAllTimeframes, buildRecommendation } from '../../../lib/recommendation';
import { sendTelegram, formatDailySummary } from '../../../lib/telegramBot';
const COINS=[{sym:'BTCUSDT',label:'BTC'},{sym:'ETHUSDT',label:'ETH'},{sym:'SOLUSDT',label:'SOL'},{sym:'BNBUSDT',label:'BNB'}];
export default async function handler(req, res) {
  try {
    const macroData=await fetchMacroData(); const macroTrend=calcMacroTrend(macroData);
    const recs=[];
    for(const {sym,label} of COINS){const tfs=await fetchAllTimeframes(sym);recs.push(buildRecommendation(macroTrend,tfs,label));}
    await sendTelegram(formatDailySummary(recs));
    res.status(200).json({ok:true,sent:recs.length});
  } catch(e){res.status(500).json({error:e.message});}
}