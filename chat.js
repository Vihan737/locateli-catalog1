// Vercel Serverless Function — POST /api/chat
// Proxies the catalog's product-advisor chat to the Google Gemini API
// (free tier — no credit card needed as of this writing).
// The API key lives ONLY here (as a server environment variable), never in
// the browser, so it can never be stolen by someone reading the page source.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MAX_TURNS = 12;          // how much history we forward per request
const MAX_TEXT_BYTES = 4000;   // clamp one incoming message's length

// --- very small per-IP rate limit (best-effort; resets when the function cools down) ---
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
function rateLimited(ip) {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function setCors(res) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'server_misconfigured', message: 'GEMINI_API_KEY is not set' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const turns = Array.isArray(body?.turns) ? body.turns : null;
  if (!turns || turns.length === 0) {
    res.status(400).json({ error: 'invalid_request', message: 'turns must be a non-empty array' });
    return;
  }

  // keep only the last MAX_TURNS, clamp each message's size
  // Gemini uses role "model" instead of "assistant"
  const contents = turns.slice(-MAX_TURNS).map((t) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(t.content || '').slice(0, MAX_TEXT_BYTES) }],
  }));
  if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '.' }] });
  if (contents[contents.length - 1].role !== 'user') {
    res.status(400).json({ error: 'invalid_request', message: 'last turn must be from the user' });
    return;
  }

  const SYSTEM_PROMPT = require('./system-prompt.js');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok || !data) {
      res.status(upstream.status || 502).json({
        error: 'upstream_error',
        message: data?.error?.message || `HTTP ${upstream.status}`,
      });
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text.trim()) {
      const reason = data?.candidates?.[0]?.finishReason;
      res.status(502).json({ error: 'upstream_error', message: `empty reply (${reason || 'unknown'})` });
      return;
    }

    // stream the finished answer to the browser in small chunks, so the chat
    // bubble fills in progressively instead of popping in all at once
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    const chunkSize = 8;
    for (let i = 0; i < text.length; i += chunkSize) {
      res.write(text.slice(i, i + chunkSize));
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 18));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream_error', message: String(err) });
    } else {
      res.end();
    }
  }
};
