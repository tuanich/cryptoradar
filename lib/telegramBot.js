// telegramBot.js
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) { console.warn('Telegram not configured'); return false; }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chat_id:CHAT_ID, text, parse_mode:'HTML'}) });
  const data = await res.json();
  if (!data.ok) console.error('Telegram error:', data);
  return data.ok;
}
function fmtPrice(p) { return p>1000?'$'+Math.round(p).toLocaleString():'$'+p.toFixed(4); }
function sigEmoji(s) { return s==='STRONG BUY'?'🟢🟢':s==='BUY'?'🟢':s==='STRONG SELL'?'🔴🔴':s==='SELL'?'🔴':'⚪'; }
function formatAlertMessage(rec, isChange=false) {
  const {coin,price,chgPct,action,confidence,layers,macroTrend,timeframes,levels}=rec;
  const chgStr=(chgPct>=0?'+':'')+chgPct.toFixed(2)+'%';
  const changeNote=isChange?'\n🔔 <b>Signal changed!</b>':'';
  return `🚨 <b>CryptoRadar — ${coin}/USDT</b>${changeNote}
━━━━━━━━━━━━━━━━━━
📊 <b>Action:</b> ${action}
💰 <b>Price:</b> ${fmtPrice(price)} (${chgStr})
${confidence>=80?'🔥':confidence>=60?'⚡':'⚠️'} <b>Confidence:</b> ${confidence}% (${layers}/5 layers)
━━━━━━━━━━━━━━━━━━
🌍 <b>Macro:</b> ${macroTrend.trend} (${macroTrend.pct>0?'+':''}${macroTrend.pct}%)
${sigEmoji(timeframes['1w'])} <b>Weekly:</b> ${timeframes['1w']}
${sigEmoji(timeframes['1d'])} <b>Daily:</b>  ${timeframes['1d']}
${sigEmoji(timeframes['4h'])} <b>4h:</b>     ${timeframes['4h']}
${sigEmoji(timeframes['1h'])} <b>1h:</b>     ${timeframes['1h']}
━━━━━━━━━━━━━━━━━━
🛑 <b>Stop loss:</b>  ${fmtPrice(levels.sl)} (-${levels.slPct}%)
✅ <b>TP1 (50%):</b>  ${fmtPrice(levels.tp1)} (+${levels.tp1Pct}%) R:R 1.3
✅ <b>TP2 (rest):</b> ${fmtPrice(levels.tp2)} (+${levels.tp2Pct}%) R:R 2.0
━━━━━━━━━━━━━━━━━━
⚠️ <i>Educational only. Not financial advice.</i>`;
}
function formatDailySummary(recs) {
  const now=new Date().toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'medium'});
  let msg=`📅 <b>CryptoRadar — Daily Summary</b>\n${now} (Vietnam time)\n━━━━━━━━━━━━━━━━━━\n`;
  recs.forEach(rec=>{const e=rec.actionShort==='BUY'?'🟢':rec.actionShort==='SELL'?'🔴':'⚪';msg+=`${e} <b>${rec.coin}</b> ${fmtPrice(rec.price)} — ${rec.action} (${rec.confidence}%)\n`;});
  msg+=`━━━━━━━━━━━━━━━━━━\n🌍 <b>Macro:</b> ${recs[0]?.macroTrend?.trend||'UNKNOWN'}\n⚠️ <i>Not financial advice.</i>`;
  return msg;
}
function formatMacroShift(oldTrend, newTrend) {
  const e=newTrend==='BULL'||newTrend==='MILD BULL'?'📈':'📉';
  return `${e} <b>Macro Trend Shift!</b>\n━━━━━━━━━━━━━━━━━━\n<b>From:</b> ${oldTrend}\n<b>To:</b> ${newTrend}\n⚠️ <i>Not financial advice.</i>`;
}
module.exports = { sendTelegram, formatAlertMessage, formatDailySummary, formatMacroShift };