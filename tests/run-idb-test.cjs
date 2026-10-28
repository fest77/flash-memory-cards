'use strict';
/**
 * IndexedDB 真实时钟回归测试（headless 虚拟时钟下 IDB 不可靠，故单列一个 runner）。
 * 覆盖 v1.12.8 修复的图片索引 bug：
 *   1) 并行写图不再丢 imgIndex 条目
 *   2) 索引丢条目后，重复导入同样内容会自愈（重导同样的 zip 能修回图片）
 *   3) 从真实存储重建索引（修回已被旧版本破坏的图库）
 * 用法: node tests/run-idb-test.cjs [dist/md-flashcards.html]
 * 找不到 Chromium 内核浏览器时跳过（CI 的 ubuntu runner 无 Edge）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(ROOT, 'dist', 'md-flashcards.html');
const PORT = 9444;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mdfc-idb-'));

const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));

function fail(msg) { console.error('FAIL: ' + msg); process.exit(1); }

if (!fs.existsSync(HTML)) fail('产物不存在，先运行 python scripts/build.py: ' + HTML);
if (!BROWSER) {
  console.log('skip 未找到 Chromium 内核浏览器，跳过 IDB 测试');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const proc = spawn(BROWSER, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files',
    '--user-data-dir=' + path.join(TMP, 'prof'),
    '--remote-debugging-port=' + PORT,
    'file:///' + HTML.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 75; i++) {
    await sleep(400);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) { /* not up yet */ }
  }
  if (!target) { proc.kill(); fail('CDP 未就绪'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 120000 });
    const ex = r.result && r.result.exceptionDetails;
    if (ex) throw new Error('page exception: ' + JSON.stringify(ex.exception || ex.text));
    return r.result && r.result.result ? r.result.result.value : null;
  };

  let booted = false;
  for (let i = 0; i < 60; i++) {
    booted = await evalJs('!!(window.MDReviewApp && window.MDReviewApp.state())');
    if (booted) break;
    await sleep(300);
  }
  if (!booted) { proc.kill(); fail('应用未启动'); }

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' :: ' + JSON.stringify(detail) : ''));
  };

  const probeNames = [];
  for (let i = 0; i < 40; i++) probeNames.push('probe-' + i + '.png');

  // 1) 并行写 40 张图：索引必须一条不少
  const conc = await evalJs(`(async function () {
    var A = window.MDReviewApp, names = ${JSON.stringify(probeNames)}, jobs = [];
    for (var i = 0; i < names.length; i++) {
      var bytes = []; for (var b = 0; b < 64; b++) bytes.push((i * 7 + b) % 251);
      jobs.push(A.storeImageForTest(names[i], bytes));
    }
    var res = await Promise.all(jobs);
    var idx = await A.imgIndexNames();
    var present = names.filter(function (n) { return idx.indexOf(n) >= 0; }).length;
    return { requested: names.length, storedOk: res.filter(Boolean).length, inIndex: present };
  })()`);
  check('并行写图不丢索引（40 张全部入索引）', conc.inIndex === conc.requested && conc.storedOk === conc.requested, conc);

  // 2) 索引丢条目后，重复导入同样内容会自愈（对应「重导同一个 zip 修不回来」）
  const heal = await evalJs(`(async function () {
    var A = window.MDReviewApp, name = 'probe-0.png';
    var idx = await A.imgIndexNames();
    // 模拟旧版本损坏：把这条从索引里抹掉，但保留 blob
    await A.setImgIndexForTest(idx.filter(function (n) { return n !== name; }));
    var before = (await A.imgIndexNames()).indexOf(name) >= 0;
    var bytes = []; for (var b = 0; b < 64; b++) bytes.push((0 * 7 + b) % 251);
    await A.storeImageForTest(name, bytes);   // 同样的内容再导一次（去重命中路径）
    var after = (await A.imgIndexNames()).indexOf(name) >= 0;
    return { before: before, after: after };
  })()`);
  check('重导同样内容会补回索引条目（自愈）', heal.before === false && heal.after === true, heal);

  // 3) 从真实存储重建索引（修复已被旧版本破坏的图库）
  const repair = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    // 再模拟一次更严重的损坏：索引只留 3 条
    var idx = await A.imgIndexNames();
    await A.setImgIndexForTest(idx.slice(0, 3));
    var res = await A.loadStoredImages();
    var after = await A.imgIndexNames();
    return { added: res && res.added, dropped: res && res.dropped, total: res && res.total, indexLen: after.length };
  })()`);
  check('重建索引补回丢失条目', repair.added >= 37 && repair.indexLen >= 40, repair);

  // 4) 索引损坏 → 修复后卡片里的图片真的从「未导入」恢复成图片
  const render = await evalJs(`(async function () {
    var A = window.MDReviewApp, name = 'recover-1.png';
    var bytes = []; for (var b = 0; b < 64; b++) bytes.push((b * 3) % 251);
    await A.setImgForTest(name, bytes);
    await A.setImgIndexForTest((await A.imgIndexNames()).filter(function (n) { return n !== name; }));
    var before = A.resolveImgSrc('<img src="' + name + '">');
    await A.loadStoredImages();
    var after = A.resolveImgSrc('<img src="' + name + '">');
    return { beforeMissing: /img-missing/.test(before), afterBlob: /src="blob:/.test(after) };
  })()`);
  check('修复后图片从「未导入」恢复为实际图片', render.beforeMissing === true && render.afterBlob === true, render);

  // 5) v1.12.10：Android 选择器把 svg 报成 application/octet-stream → 存进来时就纠正类型
  //    （Chromium 对 PNG/JPEG 会按文件头嗅探，所以只有 svg 这类「必须靠 MIME 认定」的图会整张失败）
  const typedStore = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24"><rect width="48" height="24" fill="#0a0"/></svg>';
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(svg));
    function loads(url) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(im.naturalWidth > 0); };
        im.onerror = function () { res(false); };
        im.src = url;
        setTimeout(function () { res(im.naturalWidth > 0); }, 3000);
      });
    }
    await A.storeImageForTest('typed-a.svg', bytes, 'application/octet-stream');
    var storedType = await A.imgBlobTypeForTest('typed-a.svg');
    var html = A.resolveImgSrc('<img src="typed-a.svg">');
    var m = /src="([^"]+)"/.exec(html);
    var fixedOk = m ? await loads(m[1]) : false;
    return { storedType: storedType, fixedOk: fixedOk };
  })()`);
  check('存图时纠正 svg 的 MIME 类型（纠正后 objectURL 能解码）',
    typedStore.storedType === 'image/svg+xml' && typedStore.fixedOk === true, typedStore);

  // 5b) 坏类型确实解不出来（根因机理），且重导同内容会自愈
  const typedDedupe = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24"><rect width="48" height="24" fill="#0a0"/></svg>';
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(svg));
    function loads(url) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(im.naturalWidth > 0); };
        im.onerror = function () { res(false); };
        im.src = url;
        setTimeout(function () { res(im.naturalWidth > 0); }, 3000);
      });
    }
    await A.setImgForTest('typed-a.svg', bytes, 'application/octet-stream'); // 旧版本留下的坏记录
    var rawOk = await loads(await A.imgRawUrlForTest('typed-a.svg'));
    await A.storeImageForTest('typed-a.svg', bytes, 'application/octet-stream'); // 同样的内容重导（去重命中）
    var html = A.resolveImgSrc('<img src="typed-a.svg">');
    var m = /src="([^"]+)"/.exec(html);
    var healedOk = m ? await loads(m[1]) : false;
    return { rawOk: rawOk, healedOk: healedOk };
  })()`);
  check('坏类型 objectURL 解不出图片；重导时去重路径也会纠正类型',
    typedDedupe.rawOk === false && typedDedupe.healedOk === true, typedDedupe);

  // 6) 已有坏记录（旧版本存进去的类型为空）→ 启动/修复时按扩展名重建 URL 即可恢复
  const typedLegacy = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24"><rect width="48" height="24" fill="#08f"/></svg>';
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(svg));
    await A.setImgForTest('typed-b.svg', bytes, '');        // 模拟旧版本留下的空类型记录
    var idx = await A.imgIndexNames();
    if (idx.indexOf('typed-b.svg') < 0) await A.setImgIndexForTest(idx.concat(['typed-b.svg']));
    var rep = await A.loadStoredImages();
    var html = A.resolveImgSrc('<img src="typed-b.svg">');
    var m = /src="([^"]+)"/.exec(html);
    var ok = false;
    if (m) {
      ok = await new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(im.naturalWidth > 0); };
        im.onerror = function () { res(false); };
        im.src = m[1];
        setTimeout(function () { res(im.naturalWidth > 0); }, 3000);
      });
    }
    var hasName = /data-img="typed-b\\.svg"/.test(html);
    return { retyped: rep && rep.retyped, loads: ok, hasName: hasName };
  })()`);
  check('旧记录的空 MIME 在加载/修复时被纠正（图片恢复、带文件名标记）',
    typedLegacy.retyped >= 1 && typedLegacy.loads === true && typedLegacy.hasName === true, typedLegacy);

  // 7) 真正解不出来的图 → 换成「图片无法显示：名字」占位，而不是让浏览器把 alt 撑成假图
  const brokenChip = await evalJs(`(async function () {
    var host = document.createElement('div');
    host.innerHTML = '<img data-img="probe.svg" alt="probe.svg" src="data:text/plain;base64,PGh0bWw+YmFk">';
    document.body.appendChild(host);
    await new Promise(function (r) { setTimeout(r, 800); });
    var chip = host.querySelector('.img-missing');
    var left = host.querySelector('img');
    var text = chip ? chip.textContent : '';
    host.remove();
    return { hasChip: !!chip, stillImg: !!left, hasName: text.indexOf('probe.svg') >= 0 };
  })()`);
  check('解码失败的图片显示明确占位（保留文件名）',
    brokenChip.hasChip === true && brokenChip.stillImg === false && brokenChip.hasName === true, brokenChip);

  // 收尾：按名字删除探针数据，不污染用户图库
  await evalJs(`(async function () {
    var A = window.MDReviewApp, names = ${JSON.stringify(probeNames)};
    var extra = ['recover-1.png', 'typed-a.svg', 'typed-b.svg'];
    var idx = await A.imgIndexNames();
    await A.setImgIndexForTest(idx.filter(function (n) { return names.indexOf(n) < 0 && extra.indexOf(n) < 0; }));
    for (var i = 0; i < names.length; i++) { try { await A.rawDeleteForTest('img/' + names[i]); } catch (e) {} }
    for (var j = 0; j < extra.length; j++) { try { await A.rawDeleteForTest('img/' + extra[j]); } catch (e) {} }
    return true;
  })()`).catch(() => null);

  ws.close();
  proc.kill();

  const bad = results.filter((r) => !r.ok);
  console.log('\nIDB 真实时钟测试：' + (results.length - bad.length) + ' / ' + results.length + (bad.length ? '（有失败）' : ' 通过'));
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => fail(e.message));
