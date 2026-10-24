'use strict';
/**
 * 布局诊断：在 headless Edge 里量出真实视口宽度、是否有横向溢出、最宽元素。
 * 用法: node test/run-diag.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML = path.join(DIST, 'md-flashcards.html');
const SHOT_HARNESS = path.join(__dirname, 'shot-harness.js');
const PROFILE = path.join(DIST, '_edge-profile-diag');
const PAGE = path.join(DIST, '_diag.html');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!edge) {
  console.log('skip 未找到 Edge/Chrome');
  process.exit(0);
}

const diag = `
(function () {
  function rect(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
  }
  function collect() {
    var wide = [];
    Array.prototype.forEach.call(document.querySelectorAll('body *'), function (el) {
      var r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1) {
        wide.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 40), right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    wide.sort(function (a, b) { return b.right - a.right; });
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dpr: window.devicePixelRatio,
      app: rect('#app'),
      topbar: rect('#topbar'),
      topActions: rect('.top-actions'),
      statbar: rect('#statBar'),
      actionRow: rect('#homeBody .action-grid'),
      deck: rect('.deck'),
      deckActions: rect('.deck-actions'),
      deepestWide: wide.slice(0, 8)
    };
  }
  setTimeout(function () {
    document.body.setAttribute('data-diag', JSON.stringify(collect()));
    document.title = 'DIAG-DONE';
  }, 1200);
})();
`;

const html = fs.readFileSync(HTML, 'utf8');
const harness = fs.readFileSync(SHOT_HARNESS, 'utf8');
const page = html.replace(
  '</body>',
  '<script>window.__SHOT_MODE__ = "home";</script>\n<script>' + harness + '</script>\n<script>' + diag + '</script>\n</body>'
);
fs.writeFileSync(PAGE, page, 'utf8');

const args = [
  '--headless=new',
  '--disable-gpu',
  '--disable-crash-reporter',
  '--disable-breakpad',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--allow-file-access-from-files',
  '--hide-scrollbars',
  '--window-size=400,900',
  '--user-data-dir=' + PROFILE,
  '--virtual-time-budget=9000',
  '--dump-dom',
  'file:///' + PAGE.replace(/\\/g, '/'),
];

const outPath = path.join(DIST, '_diag-dom.html');
const fdOut = fs.openSync(outPath, 'w');
const fdErr = fs.openSync(path.join(DIST, '_diag.err.txt'), 'w');
try {
  execFileSync(edge, args, { stdio: ['ignore', fdOut, fdErr], timeout: 120000 });
} catch (e) {
  // 忽略：读取 dump 文件
} finally {
  fs.closeSync(fdOut);
  fs.closeSync(fdErr);
}

const dom = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
const m = /data-diag="([^"]*)"/.exec(dom);
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }

if (!m) {
  console.log('FAIL 没有拿到诊断数据，DOM 见 ' + outPath);
  process.exit(1);
}
const info = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
console.log(JSON.stringify(info, null, 2));
try { fs.unlinkSync(PAGE); } catch (e) { /* ignore */ }
