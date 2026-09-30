// Runs on Vercel during each deploy (package.json → "build").
// WhatsApp / Telegram link previews need FULL addresses for the preview image, so the
// site's own production address is written into public/index.html here. It never fails
// the deploy: if the address is unknown, the page is left exactly as it is.
'use strict';
const fs = require('fs');
const path = require('path');

try {
  const host = String(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (!host) {
    console.log('[site-url] production address not available — link-preview tags left unchanged');
    process.exit(0);
  }
  const base = 'https://' + host;
  const file = path.join(__dirname, '..', 'public', 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  html = html.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + base + '/og-image.jpg">');
  const extra = [];
  if (!/property="og:url"/.test(html)) extra.push('<meta property="og:url" content="' + base + '/">');
  if (!/name="twitter:image"/.test(html)) extra.push('<meta name="twitter:image" content="' + base + '/og-image.jpg">');
  if (!/rel="canonical"/.test(html)) extra.push('<link rel="canonical" href="' + base + '/">');
  if (extra.length) html = html.replace('<meta name="twitter:card"', extra.join('\n') + '\n<meta name="twitter:card"');

  fs.writeFileSync(file, html);
  console.log('[site-url] link previews point to ' + base);
} catch (e) {
  console.log('[site-url] skipped: ' + (e && e.message));
}
process.exit(0);
