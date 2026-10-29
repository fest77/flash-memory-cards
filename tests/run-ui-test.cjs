'use strict';
/**
 * 交互回归（v1.12.12）：图片大图 + 宽表格
 *   1) 双击放大后可单指拖动平移（transform 的 translate 会变）
 *   2) 双指捏合能连续改变 scale
 *   3) 未放大时左右滑动 → 关闭大图（安卓返回手势式退出）
 *   4) 宽表格不再压缩列宽：外层可横向滚动、列有最小宽度；窄表格不产生滚动
 * 用 CDP + 真实时钟（合成 Touch/Mouse 事件需要真实 rAF/计时）。
 * 用法: node tests/run-ui-test.cjs [dist/md-flashcards.html]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(ROOT, 'dist', 'md-flashcards.html');
const PORT = 9459;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mdfc-ui-'));

const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) { console.error('FAIL: ' + msg); process.exit(1); }

if (!fs.existsSync(HTML)) fail('产物不存在，先运行 python scripts/build.py: ' + HTML);
if (!BROWSER) {
  if (process.env.REQUIRE_BROWSER) fail('未找到 Chromium 内核浏览器（REQUIRE_BROWSER=1）');
  console.log('skip 未找到 Chromium 内核浏览器，跳过 UI 交互测试');
  process.exit(0);
}

async function main() {
  const proc = spawn(BROWSER, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files',
    '--user-data-dir=' + path.join(TMP, 'prof'),
    '--remote-debugging-port=' + PORT,
    '--window-size=420,820',
    'file:///' + HTML.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 100; i++) {
    await sleep(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) { /* not up yet */ }
  }
  if (!target) { proc.kill(); fail('CDP 未就绪'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let seq = 0; const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const evalJs = async (expression, timeout) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: timeout || 60000 });
    if (r.result && r.result.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : null;
  };

  for (let i = 0; i < 100; i++) {
    if (await evalJs('!!(window.MDReviewApp && window.MDReviewApp.state())')) break;
    await sleep(300);
  }

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''));
  };

  // 合成触摸事件的小工具（注入一次，后面复用）
  const setupHelper = `(function () {
    if (window.__mkTouch) return 'ok';
    var ID = 0;
    window.__mkTouch = function (el, type, pts) {
      var list = pts.map(function (p) {
        return new Touch({ identifier: p.id || 0, target: el, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y });
      });
      var ev = new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : list,
        targetTouches: type === 'touchend' ? [] : list,
        changedTouches: list
      });
      el.dispatchEvent(ev);
    };
    return 'ok';
  })()`;
  await evalJs(setupHelper);

  // 一张很大的测试图（data URL，不依赖图库）
  await evalJs(`(function () {
    window.__bigSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#123"/>' +
      '<circle cx="600" cy="450" r="300" fill="#4af"/></svg>');
    return true;
  })()`);

  // 1) 双击 → 放大
  const dbl = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    A.openImageViewer(window.__bigSvg);
    await new Promise(function (r) { setTimeout(r, 120); });
    var img = document.querySelector('#imgViewer img');
    var r = img.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    window.__mkTouch(img, 'touchstart', [{ id: 0, x: x, y: y }]);
    window.__mkTouch(img, 'touchend', [{ id: 0, x: x, y: y }]);
    await new Promise(function (r2) { setTimeout(r2, 60); });
    window.__mkTouch(img, 'touchstart', [{ id: 0, x: x, y: y }]);
    window.__mkTouch(img, 'touchend', [{ id: 0, x: x, y: y }]);
    await new Promise(function (r3) { setTimeout(r3, 250); });
    var t = A.imgViewerTransform();
    return { transform: t, scaled: /scale\\(2\\.5\\)/.test(t) };
  })()`);
  check('双击放大到 2.5x', dbl.scaled === true, dbl.transform);

  // 2) 放大后单指拖动 → 平移量变化
  const pan = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var img = document.querySelector('#imgViewer img');
    var before = A.imgViewerTransform();
    var r = img.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    window.__mkTouch(img, 'touchstart', [{ id: 0, x: x, y: y }]);
    for (var i = 1; i <= 6; i++) window.__mkTouch(img, 'touchmove', [{ id: 0, x: x - i * 20, y: y - i * 10 }]);
    window.__mkTouch(img, 'touchend', [{ id: 0, x: x - 120, y: y - 60 }]);
    await new Promise(function (res) { setTimeout(res, 150); });
    var after = A.imgViewerTransform();
    var m1 = /translate3d\\((-?[\\d.]+)px, *(-?[\\d.]+)px/.exec(before) || [];
    var m2 = /translate3d\\((-?[\\d.]+)px, *(-?[\\d.]+)px/.exec(after) || [];
    return { before: before, after: after, movedX: Math.abs(parseFloat(m2[1] || 0) - parseFloat(m1[1] || 0)) > 20 };
  })()`);
  check('放大后单指拖动可平移', pan.movedX === true, pan.after);

  // 3) 双指捏合 → scale 变化
  const pinch = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var img = document.querySelector('#imgViewer img');
    var r = img.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var before = A.imgViewerTransform();
    window.__mkTouch(img, 'touchstart', [{ id: 0, x: cx - 40, y: cy }, { id: 1, x: cx + 40, y: cy }]);
    for (var i = 1; i <= 6; i++) {
      window.__mkTouch(img, 'touchmove', [{ id: 0, x: cx - 40 - i * 12, y: cy }, { id: 1, x: cx + 40 + i * 12, y: cy }]);
    }
    window.__mkTouch(img, 'touchend', [{ id: 0, x: cx - 112, y: cy }]);
    await new Promise(function (res) { setTimeout(res, 150); });
    var after = A.imgViewerTransform();
    var s1 = parseFloat((/scale\\(([\\d.]+)\\)/.exec(before) || [0, 0])[1]);
    var s2 = parseFloat((/scale\\(([\\d.]+)\\)/.exec(after) || [0, 0])[1]);
    return { before: before, after: after, grew: s2 > s1 + 0.3 };
  })()`);
  check('双指捏合可连续缩放', pinch.grew === true, pinch.after);

  // 4) 复位后左右滑动 → 关闭大图
  const swipe = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    // 双击复位到 1x
    var img = document.querySelector('#imgViewer img');
    var r = img.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (var d = 0; d < 2; d++) {
      window.__mkTouch(img, 'touchstart', [{ id: 0, x: x, y: y }]);
      window.__mkTouch(img, 'touchend', [{ id: 0, x: x, y: y }]);
      await new Promise(function (res) { setTimeout(res, 60); });
    }
    await new Promise(function (res) { setTimeout(res, 250); });
    var atOne = /scale\\(1\\)/.test(A.imgViewerTransform());
    // 左滑 160px
    window.__mkTouch(img, 'touchstart', [{ id: 0, x: x + 80, y: y }]);
    for (var i = 1; i <= 8; i++) window.__mkTouch(img, 'touchmove', [{ id: 0, x: x + 80 - i * 20, y: y }]);
    window.__mkTouch(img, 'touchend', [{ id: 0, x: x - 80, y: y }]);
    await new Promise(function (res) { setTimeout(res, 320); });
    var hidden = document.getElementById('imgViewer').classList.contains('hidden');
    return { atOne: atOne, hidden: hidden };
  })()`);
  check('未放大时左滑退出大图', swipe.atOne === true && swipe.hidden === true, swipe);

  // 5) 宽表格：外层可横向滚动、列不被压扁
  const table = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var md = '| 字段 | 含义说明很长的列 | 另一个很长的列 | 数值 |\\n|---|---|---|---|\\n' +
      '| 商品编号 | 用来唯一标识一个商品的编号 | 由仓储系统生成并同步 | 128 |\\n' +
      '| 库存数量 | 当前可售数量，含预售占用 | 每分钟同步一次 | 3 |';
    var host = document.createElement('div');
    host.style.width = '340px';
    document.body.appendChild(host);
    host.innerHTML = A.renderAnswerHtml(md, { name: 'x', cards: [] });
    await new Promise(function (r) { setTimeout(r, 60); });
    var wrap = host.querySelector('.md-table-wrap');
    var tbl = host.querySelector('.md-table table');
    var cell = host.querySelector('.md-table th');
    var res = {
      hasWrap: !!wrap,
      scrollable: !!wrap && wrap.scrollWidth > wrap.clientWidth + 8,
      tableWider: !!tbl && !!wrap && tbl.getBoundingClientRect().width > wrap.clientWidth,
      cellWidth: cell ? Math.round(cell.getBoundingClientRect().width) : 0
    };
    host.remove();
    return res;
  })()`);
  check('宽表格可横向滚动且列宽不被压扁',
    table.hasWrap === true && table.scrollable === true && table.tableWider === true && table.cellWidth >= 60, table);

  // 6) 窄表格不产生横向滚动（避免处处出滚动条）
  const narrow = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var md = '| 项 | 值 |\\n|---|---|\\n| 卡片 | 3 |';
    var host = document.createElement('div');
    host.style.width = '340px';
    document.body.appendChild(host);
    host.innerHTML = A.renderAnswerHtml(md, { name: 'x', cards: [] });
    await new Promise(function (r) { setTimeout(r, 60); });
    var wrap = host.querySelector('.md-table-wrap');
    var res = { scrollWidth: wrap ? wrap.scrollWidth : -1, clientWidth: wrap ? wrap.clientWidth : -1,
      overflows: !!wrap && wrap.scrollWidth > wrap.clientWidth + 8 };
    host.remove();
    return res;
  })()`);
  check('窄表格不超过容器、不出现滚动条', narrow.overflows === false, narrow);

  // 7) 反复开关大图不应叠加监听器（多次打开后拖动只移动一次，位移 = 手指位移）
  const reopen = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    for (var k = 0; k < 3; k++) {
      A.openImageViewer(window.__bigSvg);
      await new Promise(function (r) { setTimeout(r, 80); });
      A.closeImageViewer();
    }
    A.openImageViewer(window.__bigSvg);
    await new Promise(function (r) { setTimeout(r, 100); });
    var img = document.querySelector('#imgViewer img');
    var r = img.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    // 双击放大
    for (var d = 0; d < 2; d++) {
      window.__mkTouch(img, 'touchstart', [{ id: 0, x: x, y: y }]);
      window.__mkTouch(img, 'touchend', [{ id: 0, x: x, y: y }]);
      await new Promise(function (res) { setTimeout(res, 60); });
    }
    await new Promise(function (res) { setTimeout(res, 220); });
    // 拖 60px
    window.__mkTouch(img, 'touchstart', [{ id: 0, x: x, y: y }]);
    for (var i = 1; i <= 3; i++) window.__mkTouch(img, 'touchmove', [{ id: 0, x: x - i * 20, y: y }]);
    window.__mkTouch(img, 'touchend', [{ id: 0, x: x - 60, y: y }]);
    await new Promise(function (res) { setTimeout(res, 150); });
    var t = A.imgViewerTransform();
    var mx = /translate3d\\((-?[\\d.]+)px/.exec(t);
    return { transform: t, dx: mx ? Math.round(parseFloat(mx[1])) : null };
  })()`);
  check('反复开关大图后手势不叠加（拖 60px 只移动 60px）',
    reopen.dx !== null && Math.abs(reopen.dx + 60) <= 6, reopen);

  ws.close();
  proc.kill();

  const bad = results.filter((r) => !r.ok);
  console.log('\nUI 交互测试：' + (results.length - bad.length) + ' / ' + results.length + (bad.length ? '（有失败）' : ' 通过'));
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => fail(e.message));