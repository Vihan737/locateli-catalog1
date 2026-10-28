// api/prices.js — live price lists for the catalogue, read from the Google Sheet.
//
// The sheet has one tab per list («آشپزخانه», «فلزی»). Whatever is in the
// «قیمت نهایی» column is what customers see; rows with «نمایش در سایت» = خیر are hidden.
//
// Sheet address: set PRICE_SHEET_ID in Vercel → Settings → Environment Variables,
// or paste the id between the quotes below. The id is the long part of the sheet link:
// https://docs.google.com/spreadsheets/d/<<THIS PART>>/edit
// The sheet must be shared as «Anyone with the link → Viewer».
const SHEET_ID = process.env.PRICE_SHEET_ID || '1Q1uM1Se7qQhALqMKdFv_6VeJWxxe3bJiq8ztb3DlB0M';

const TABS = { kitchen: 'آشپزخانه', metal: 'فلزی' };
const COLS = { group: 'گروه', name: 'نام کالا', detail: 'جزئیات', colors: 'رنگ‌بندی',
  price: 'قیمت نهایی', unit: 'واحد', img: 'کد عکس', show: 'نمایش در سایت' };

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const norm = (s) => String(s || '').replace(/[‌\s]+/g, ' ').trim();
const toNumber = (s) => {
  const t = String(s || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, '');
  const n = Math.round(parseFloat(t)); return isFinite(n) && n > 0 ? n : null;
};

module.exports = async function handler(req, res) {
  const list = (req.query && req.query.list) || new URL(req.url, 'http://x').searchParams.get('list');
  const tab = TABS[list];
  if (!tab) { res.status(400).json({ error: 'unknown list' }); return; }
  if (!SHEET_ID) { res.status(503).json({ error: 'sheet not set' }); return; }
  const url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(SHEET_ID) +
    '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(tab);
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'locatelli-catalog' } });
    if (!r.ok) throw new Error('sheet http ' + r.status);
    const csv = await r.text();
    if (/^\s*</.test(csv)) throw new Error('sheet is not shared publicly');
    const table = parseCSV(csv);
    const head = (table.shift() || []).map(norm);
    // exact header first; otherwise a header that starts with it (e.g. «قیمت نهایی (تومان)»)
    const idx = {};
    for (const k in COLS) {
      const want = norm(COLS[k]);
      idx[k] = head.indexOf(want);
      if (idx[k] < 0 && k === 'price') idx[k] = head.findIndex((h) => h.includes('نهایی'));
      if (idx[k] < 0 && k === 'unit') idx[k] = head.findIndex((h) => h.includes('واحد'));
    }
    // when the final-price header says «تومان», prices are already converted to toman
    const priceInToman = idx.price >= 0 && head[idx.price].includes('تومان');
    if (idx.name < 0 || idx.price < 0) throw new Error('columns not found: ' + head.join(' | '));
    const get = (row, k) => (idx[k] >= 0 ? String(row[idx[k]] || '').trim() : '');
    const rows = table
      .filter((row) => get(row, 'name') && get(row, 'show') !== 'خیر')
      .map((row) => ({ group: get(row, 'group'), name: get(row, 'name'), detail: get(row, 'detail'),
        colors: get(row, 'colors'), price: toNumber(get(row, 'price')), unit: priceInToman ? 'تومان' : get(row, 'unit'),
        img: get(row, 'img').replace(/[^0-9a-f]/gi, '') }));
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.status(200).json({ list, source: 'sheet', fetched: new Date().toISOString(), rows });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e && e.message || e) });
  }
};
