'use strict';
/**
 * 验证 file:// 打开时数据能否跨会话持久化。
 * 同一个 html 文件跑两次、同一个 profile：
 *   第 1 次：没有数据 → 导入测试笔记 → 报告 "wrote"
 *   第 2 次：应能读到数据 → 报告 "read:{decks,cards}"
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML = path.join(DIST, 'md-flashcards.html');
const PAGE = path.join(DIST, '_persist.html');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!EDGE) { console.log('skip 未找到 Edge'); process.exit(0); }

const html = fs.readFileSync(HTML, 'utf8');
const md = '# 持久化测试\n\n## 卡片A\n\n答案A\n\n## 卡片B\n\n答案B\n';

const script = `
(function(){
  var t0 = Date.now();
  function report(v){
    document.body.setAttribute('data-persist', v);
    document.title = 'DONE';
  }
  (function wait(){
    var app = window.MDReviewApp;
    if (app && app.state && app.state()) {
      var st = app.state();
      if (st.decks.length > 0) {
        var cards = st.decks.reduce(function(n,d){ return n + d.cards.length; }, 0);
        report('read:' + JSON.stringify({ decks: st.decks.length, cards: cards }));
        return;
      }
      app.importText('持久化测试', ${JSON.stringify(md)}, {mode:'auto', gran:'mid'});
      setTimeout(function(){
        report('wrote:' + app.state().decks.length);
      }, 1500);
      return;
    }
    if (Date.now() - t0 > 15000) { report('timeout'); return; }
    setTimeout(wait, 60);
  })();
})();
`;

fs.writeFileSync(PAGE, html.replace('</body>', '<script>' + script + '</script>\n</body>'), 'utf8');

function run(profile, dumpName) {
  const dump = path.join(DIST, dumpName);
  const fdOut = fs.openSync(dump, 'w');
  const fdErr = fs.openSync(dump + '.err', 'w');
  try {
    execFileSync(EDGE, [
      '--headless=new', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--allow-file-access-from-files', '--user-data-dir=' + profile,
      '--virtual-time-budget=15000', '--dump-dom',
      'file:///' + PAGE.replace(/\\/g, '/'),
    ], { stdio: ['ignore', fdOut, fdErr], timeout: 120000 });
  } catch (e) { /* 读 dump */ } finally {
    fs.closeSync(fdOut); fs.closeSync(fdErr);
  }
  const dom = fs.existsSync(dump) ? fs.readFileSync(dump, 'utf8') : '';
  const m = /data-persist="([^"]*)"/.exec(dom);
  return { value: m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '', size: dom.length };
}

const profile = path.join(DIST, '_profile-persist-' + Date.now());
const first = run(profile, '_persist1.html');
const second = run(profile, '_persist2.html');

console.log('第一次（写入）:', first.value || '(空)', '| dump', first.size, 'bytes');
console.log('第二次（读取）:', second.value || '(空)', '| dump', second.size, 'bytes');

let info = null;
try { info = JSON.parse(second.value.replace(/^read:/, '')); } catch (e) { /* ignore */ }
const ok = !!info && info.decks >= 1 && info.cards >= 2;
console.log(ok ? 'PASS file:// 数据可跨会话持久化' : 'FAIL file:// 数据没有跨会话持久化');

if (ok) {
  try {
    fs.unlinkSync(PAGE);
    ['_persist1.html', '_persist2.html', '_persist1.html.err', '_persist2.html.err'].forEach(function (f) {
      try { fs.unlinkSync(path.join(DIST, f)); } catch (e) { /* ignore */ }
    });
    fs.rmSync(profile, { recursive: true, force: true });
  } catch (e) { /* ignore */ }
}
process.exit(ok ? 0 : 1);
