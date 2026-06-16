// pages/api/cron/daily-summary.js
// Runs once daily (see vercel.json). Fetches the working /api/recommendation
// for each coin and sends one Telegram summary. Uses the live deployment URL
// so it shares the same Yahoo-Finance data path that actually works on Vercel.
const COINS = [
  { sym: 'BTCUSDT', label: 'BTC' },
  { sym: 'ETHUSDT', label: 'ETH' },
  { sym: 'SOLUSDT', label: 'SOL' },
  { sym: 'BNBUSDT', label: 'BNB' },
];
const fmtP = p => (p > 100 ? '$' + Math.round(p).toLocaleString() : '$' + (p || 0).toFixed(2));

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const d = await r.json();
  return d.ok;
}

// Fetch one coin's recommendation line. Always returns a string so a soft
// failure (bad status, missing rec) shows "data unavailable" instead of
// silently dropping the coin from the summary.
async function coinLine(base, sym, label) {
  try {
    const r = await fetch(base + '/api/recommendation?coin=' + sym + '&label=' + label);
    if (!r.ok) return { line: '\u26AA <b>' + label + '</b> \u2014 data unavailable', trend: null };
    const j = await r.json();
    const rec = j.rec;
    if (!rec) return { line: '\u26AA <b>' + label + '</b> \u2014 data unavailable', trend: null };
    const emoji = rec.actionShort === 'BUY' ? '\u{1F7E2}' : rec.actionShort === 'SELL' ? '\u{1F534}' : '\u26AA';
    return {
      line: emoji + ' <b>' + label + '</b> ' + fmtP(rec.price) + ' \u2014 ' + rec.action + ' (' + rec.confidence + '%)',
      trend: rec.macroTrend?.trend || null,
    };
  } catch (e) {
    return { line: '\u26AA <b>' + label + '</b> \u2014 data unavailable', trend: null };
  }
}

export default async function handler(req, res) {
  // Only allow Vercel Cron (or anyone holding CRON_SECRET) to trigger this.
  // Set CRON_SECRET in your Vercel project env; Vercel sends it automatically.
  if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const base = 'https://' + (process.env.VERCEL_PROJECT_PRODUCTION_URL || req.headers.host);
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' });

    // Fetch all coins in parallel; Promise.all preserves COINS order.
    const results = await Promise.all(COINS.map(c => coinLine(base, c.sym, c.label)));
    const lines = results.map(r => r.line);
    const macroTrend = results.find(r => r.trend)?.trend || 'UNKNOWN';

    const msg =
      '\u{1F4C5} <b>CryptoRadar \u2014 Daily Summary</b>\n' +
      now + ' (Vietnam time)\n' +
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      lines.join('\n') +
      '\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      '\u{1F30D} <b>Macro:</b> ' + macroTrend + '\n' +
      '\u26A0\uFE0F <i>Educational only. Not financial advice.</i>';

    const ok = await sendTelegram(msg);
    res.status(200).json({ ok, sent: lines.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
