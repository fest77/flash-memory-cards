'use strict';
/**
 * 调试 headless 截图尺寸：不同 window-size / 缩放因子下，布局视口与 PNG 尺寸的关系。
 * 只输出 PNG 尺寸，便于挑选合适参数。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML = path.join(DIST, 'md-flashcards.html');
const HARNESS = path.join(__dirname, 'shot-harness.js');
const SHOTS = path.join(DIST, 'shots');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

if (!EDGE) process.exit(0);
fs.mkdirSync(SHOTS, { recursive: true });

const html = fs.readFileSync(HTML, 'utf8');
const harness = fs.readFileSync(HARNESS, 'utf8');
const page = html.replace('</body>', '<script>window.__SHOT_MODE__="review";</script>\n<script>' + harness + '</script>\n</body>');
const pagePath = path.join(DIST, '_tune.html');
fs.writeFileSync(pagePath, page, 'utf8');

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const variants = [
  { w: 310, h: 700, dsf: 1 },
  { w: 310, h: 700, dsf: 2 },
  { w: 390, h: 844, dsf: 1 },
  { w: 390, h: 844, dsf: 2 },
  { w: 504, h: 900, dsf: 1 },
];

for (const v of variants) {
  const out = path.join(SHOTS, 'tune-' + v.w + '-x' + v.dsf + '.png');
  const profile = path.join(DIST, '_profile-tune-' + v.w + '-' + v.dsf + '-' + Date.now());
  const args = [
    '--headless=new', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--allow-file-access-from-files', '--hide-scrollbars',
    '--force-device-scale-factor=' + v.dsf,
    '--window-size=' + v.w + ',' + v.h,
    '--user-data-dir=' + profile,
    '--virtual-time-budget=8000',
    '--screenshot=' + out,
    'file:///' + pagePath.replace(/\\/g, '/'),
  ];
  try { execFileSync(EDGE, args, { stdio: 'ignore', timeout: 120000 }); } catch (e) { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  if (fs.existsSync(out)) console.log(v.w + 'x' + v.h + ' dsf=' + v.dsf + ' -> ' + JSON.stringify(pngSize(out)));
  else console.log(v.w + 'x' + v.h + ' dsf=' + v.dsf + ' -> (failed)');
}
try { fs.unlinkSync(pagePath); } catch (e) { /* ignore */ }
