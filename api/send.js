// Mening uyim 3D — Telegram Mini App: faylni (PDF, Bazis .js, DXF) bot orqali foydalanuvchi chatiga yuborish.
// Vercel → Project → Settings → Environment Variables: TELEGRAM_BOT_TOKEN = BotFather bergan token.
const crypto = require('crypto');

// Telegram WebApp initData imzosini tekshirish (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
function verify(initData, token) {
  if (!initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const dcs = [...p.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const h = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  if (h.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash))) return null;
  const age = Date.now() / 1000 - Number(p.get('auth_date') || 0);
  if (!(age < 7 * 86400)) return null;
  try { return JSON.parse(p.get('user')); } catch (e) { return null; }
}

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (req.method === 'GET') { res.status(200).json({ ok: true, bot: !!token }); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST kerak' }); return; }
  if (!token) { res.status(501).json({ ok: false, error: 'Serverda TELEGRAM_BOT_TOKEN sozlanmagan' }); return; }
  const user = verify(req.headers['x-tg-init'] || '', token);
  if (!user || !user.id) { res.status(401).json({ ok: false, error: "Telegram tekshiruvi o'tmadi — ilovani botdan oching" }); return; }
  let buf;
  try { buf = await readBody(req); } catch (e) { res.status(400).json({ ok: false, error: "Fayl o'qilmadi" }); return; }
  if (!buf || !buf.length) { res.status(400).json({ ok: false, error: "Fayl bo'sh" }); return; }
  let name = 'fayl';
  try { name = decodeURIComponent(req.headers['x-file-name'] || 'fayl'); } catch (e) {}
  name = name.replace(/[\\/\r\n\t]/g, '_').slice(0, 120) || 'fayl';
  const fd = new FormData();
  fd.append('chat_id', String(user.id));
  fd.append('caption', 'Mening uyim 3D — ' + name);
  fd.append('document', new Blob([buf]), name);
  try {
    const r = await fetch('https://api.telegram.org/bot' + token + '/sendDocument', { method: 'POST', body: fd });
    const j = await r.json();
    if (!j.ok) {
      const d = j.description || 'Telegram xatosi';
      const hint = /chat not found|blocked|initiate/i.test(d) ? ' — botga /start yozing' : '';
      res.status(502).json({ ok: false, error: d + hint });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Telegram bilan aloqa yo\'q' });
  }
};
