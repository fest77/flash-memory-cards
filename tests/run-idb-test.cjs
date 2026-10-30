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
// CDP 走全局 WebSocket（Node 22+ 才内置）：Node 20 会以「WebSocket is not defined」直接崩
if (typeof WebSocket === 'undefined') fail('需要 Node 22+（全局 WebSocket），当前 ' + process.version);
if (!BROWSER) {
  if (process.env.REQUIRE_BROWSER) fail('未找到 Chromium 内核浏览器（REQUIRE_BROWSER=1）');
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

  // 8) v1.12.12：不同子目录的同名图片（真实 zip 里 img001.png 在三个目录各一份）
  //    串行存 → 三个独立名字、三份内容都还在、都能解码；引用按路径映射
  const dupNames = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    function svg(c) {
      return Array.prototype.slice.call(new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="' + c + '"/></svg>'));
    }
    function loads(url) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(im.naturalWidth > 0); };
        im.onerror = function () { res(false); };
        im.src = url;
        setTimeout(function () { res(false); }, 3000);
      });
    }
    var r = await A.importImageEntriesForTest([
      { name: 'images/a/dup-probe.svg', bytes: svg('#f00') },
      { name: 'images/b/dup-probe.svg', bytes: svg('#0f0') },
      { name: 'images/c/dup-probe.svg', bytes: svg('#00f') }
    ]);
    var names = ['images/a/dup-probe.svg', 'images/b/dup-probe.svg', 'images/c/dup-probe.svg'].map(function (k) { return r.pathMap[k]; });
    var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
    var ok = [];
    for (var i = 0; i < names.length; i++) {
      var m = /src="([^"]+)"/.exec(A.resolveImgSrc('<img src="' + names[i] + '">'));
      ok.push(m ? await loads(m[1]) : false);
    }
    return { stored: r.stored, names: names, uniq: uniq.length, allLoad: ok.every(Boolean) };
  })()`);
  check('同名图片串行存储不互相覆盖（3 个独立名字、都能解码）',
    dupNames.stored === 3 && dupNames.uniq === 3 && dupNames.allLoad === true, dupNames);

  // 收尾：按名字删除探针数据，不污染用户图库
  await evalJs(`(async function () {
    var A = window.MDReviewApp, names = ${JSON.stringify(probeNames)};
    var extra = ['recover-1.png', 'typed-a.svg', 'typed-b.svg', 'dup-probe.svg', 'dup-probe-2.svg', 'dup-probe-3.svg'];
    var idx = await A.imgIndexNames();
    await A.setImgIndexForTest(idx.filter(function (n) { return names.indexOf(n) < 0 && extra.indexOf(n) < 0; }));
    for (var i = 0; i < names.length; i++) { try { await A.rawDeleteForTest('img/' + names[i]); } catch (e) {} }
    for (var j = 0; j < extra.length; j++) { try { await A.rawDeleteForTest('img/' + extra[j]); } catch (e) {} }
    return true;
  })()`).catch(() => null);

  // 9) 评分后落盘的 currentId 不能是「刚评完的那张」（v1.12.13）
  //    用落盘日志抓「下一次 nextCard 覆盖之前」那次写入：修复前第一次写入是刚评的卡，修复后是 null
  const afterRate = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var md = '## 一\\n\\n第一段内容。\\n\\n## 二\\n\\n第二段内容。\\n\\n## 三\\n\\n第三段内容。\\n\\n## 四\\n\\n第四段内容。';
    A.importText('idb-review-a', md, { mode: 'h2' }, { silent: true, replace: 'yes' });
    var deck = A.state().decks.filter(function (d) { return d.name === 'idb-review-a'; })[0];
    A.startReview([deck.id], { resumeOk: true });
    var ratedId = A.state().reviewSession.currentId;
    A.showAnswer();
    window.__mdfcSaveLog = [];
    A.rate('ok');
    var log = window.__mdfcSaveLog.slice();
    window.__mdfcSaveLog = null;
    await A.flushSave();
    var raw = JSON.parse(await A.readRawState());
    var s = raw.reviewSession;
    return {
      cards: deck.cards.length,
      ratedId: ratedId,
      saveLog: log,
      ratedIdSaved: log.indexOf(ratedId) >= 0,
      persistedCurrentId: s ? s.currentId : 'NO_SESSION'
    };
  })()`);
  check('评分时首次落盘的 currentId 不是刚评完的卡（落盘日志 + 磁盘双证）',
    afterRate.cards >= 2 && afterRate.ratedId && afterRate.ratedIdSaved === false &&
    afterRate.persistedCurrentId !== afterRate.ratedId, afterRate);

  // 10) 跑完一整轮：内存与磁盘的 reviewSession 都必须是 null（原来磁盘残留 currentId=最后一张）
  const afterFinish = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var guard = 0;
    function summaryShown() {
      var s = document.getElementById('rvSummary');
      return s && !s.classList.contains('hidden');
    }
    while (!summaryShown() && guard++ < 300) {
      var show = document.querySelector('[data-act="show-answer"]');
      if (show && show.offsetParent !== null) show.click();
      var ok = document.querySelector('[data-act="rate"][data-rate="ok"]');
      if (ok && ok.offsetParent !== null) ok.click();
      await new Promise(function (r) { setTimeout(r, 25); });
    }
    // 不主动 flushSave：这里要验证的是「App 自己在结束时落盘了」，主动落盘会把 bug 掩盖掉
    // 轮询而不是死等固定时间：慢 CI 上 600ms 可能不够
    var deadline = Date.now() + 2000;
    var raw = null;
    while (Date.now() < deadline) {
      raw = JSON.parse(await A.readRawState());
      if (raw && raw.reviewSession === null) break;
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    return {
      summary: summaryShown(),
      mem: A.state().reviewSession,
      persisted: raw ? raw.reviewSession : 'NO_RAW',
      guard: guard
    };
  })()`, 120000);
  check('复习结束后内存与磁盘的 reviewSession 均为 null',
    afterFinish.summary === true && afterFinish.mem === null && afterFinish.persisted === null, afterFinish);

  // 11) 防回归：单卡未评的合法会话不能被 prune 误清（prune 判定未改）
  const legitSession = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    A.importText('idb-review-b', '# 唯一\\n\\n只有这一段内容。', { mode: 'para' }, { silent: true, replace: 'yes' });
    var deck = A.state().decks.filter(function (d) { return d.name === 'idb-review-b'; })[0];
    A.startReview([deck.id], { resumeOk: true });
    var before = A.state().reviewSession;
    var beforeId = before ? before.currentId : null;
    A.renderHome();
    await new Promise(function (r) { setTimeout(r, 60); });
    var after = A.state().reviewSession;
    // 收尾：把这张评掉，避免留下会话影响后续/下次运行
    A.showAnswer();
    A.rate('ok');
    await A.flushSave();
    return {
      cards: deck.cards.length,
      beforeId: beforeId,
      stillThere: !!after,
      afterId: after ? after.currentId : null
    };
  })()`);
  check('单卡未评的合法会话不被误清（prune 判定未改）',
    legitSession.cards === 1 && legitSession.stillThere === true && legitSession.afterId === legitSession.beforeId, legitSession);

  // 12) v1.12.13：文件夹导入（有 webkitRelativePath）同名图改名后，md 引用按路径分别指向各自存储名
  const folderImport = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    function mk(name, rel, bytes, type) {
      var f = new File([new Uint8Array(bytes)], name, { type: type || 'image/png' });
      try { Object.defineProperty(f, 'webkitRelativePath', { value: rel }); } catch (e) {}
      return f;
    }
    var md = '# 笔记\\n\\n## 一\\n\\n引用 A：![](../x/img.png)\\n\\n## 二\\n\\n引用 B：![](../y/img.png)';
    A.openImportModal();
    A.addQueueFiles([
      mk('note.md', 'root/sub/note.md', Array.prototype.slice.call(new TextEncoder().encode(md)), 'text/markdown'),
      mk('img.png', 'root/x/img.png', [1, 2, 3, 4]),
      mk('img.png', 'root/y/img.png', [9, 8, 7, 6])
    ]);
    await A.pendingImageWorkForTest();
    var map = A.imgPathMapForTest();
    A.doImportQueue();
    var deadline = Date.now() + 3000;
    while (Date.now() < deadline && !A.state().decks.some(function (d) { return d.name === 'note'; })) {
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    var deck = A.state().decks.filter(function (d) { return d.name === 'note'; })[0];
    var text = deck ? deck.cards.map(function (c) { return c.answer; }).join('\\n') : '';
    return {
      mapA: map['root/x/img.png'],
      mapB: map['root/y/img.png'],
      distinct: !!map['root/x/img.png'] && map['root/y/img.png'] &&
        map['root/x/img.png'] !== map['root/y/img.png'],
      usesA: !!map['root/x/img.png'] && text.indexOf(map['root/x/img.png']) >= 0,
      usesB: !!map['root/y/img.png'] && text.indexOf(map['root/y/img.png']) >= 0,
      text: text.slice(0, 160)
    };
  })()`, 120000);
  check('文件夹导入：同名图按相对路径分别回写引用（不串图）',
    folderImport.distinct === true && folderImport.usesA === true && folderImport.usesB === true, folderImport);

  // 13) 无路径多选 + 同名歧义：不能把引用改成某个猜测的存储名
  const pathlessImport = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    function mk(name, bytes, type) {
      var f = new File([new Uint8Array(bytes)], name, { type: type || 'image/png' });
      return f;
    }
    var md = '# 无路径\\n\\n## 一\\n\\n![](img.png)';
    A.openImportModal();
    A.addQueueFiles([
      mk('note2.md', Array.prototype.slice.call(new TextEncoder().encode(md)), 'text/markdown'),
      mk('img.png', [5, 5, 5, 5]),
      mk('img.png', [6, 6, 6, 6])
    ]);
    await A.pendingImageWorkForTest();
    var map = A.imgPathMapForTest();
    A.doImportQueue();
    var deadline = Date.now() + 3000;
    while (Date.now() < deadline && !A.state().decks.some(function (d) { return d.name === 'note2'; })) {
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    var deck = A.state().decks.filter(function (d) { return d.name === 'note2'; })[0];
    var text = deck ? deck.cards.map(function (c) { return c.answer; }).join('\\n') : '';
    var sentinel = text.indexOf('__mdfc_ambiguous__/img.png') >= 0;
    var placeholder = A.resolveImgSrc('<img src="__mdfc_ambiguous__/img.png">');
    return {
      mapValue: map['img.png'],
      ambiguous: map['img.png'] === null,
      sentinel: sentinel,
      placeholder: /img-missing/.test(placeholder) && placeholder.indexOf('重名') >= 0,
      text: text.slice(0, 140)
    };
  })()`, 120000);
  check('无路径同名图歧义：写入歧义哨兵并显示「重名」占位（不猜测）',
    pathlessImport.ambiguous === true && pathlessImport.sentinel === true &&
    pathlessImport.placeholder === true, pathlessImport);

  // 14) openDB 失败后必须能重试（不能把 null 永久缓存）
  const dbRetry = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var calls = 0;
    var orig = indexedDB.open;
    indexedDB.open = function () {
      calls++;
      if (calls === 1) {
        var fake = {};
        setTimeout(function () { if (fake.onerror) fake.onerror(); }, 0);
        return fake;
      }
      return orig.apply(indexedDB, arguments);
    };
    try {
      A.store.reopen();
      var first = await A.readRawState();
      var firstFailed = (first === null);
      var attempts1 = A.openAttemptsForTest();
      var second = await A.readRawState();
      var attempts2 = A.openAttemptsForTest();
      return {
        calls: calls,
        firstFailed: firstFailed,
        retried: attempts2 > attempts1,
        secondOk: second != null,
        attempts1: attempts1,
        attempts2: attempts2
      };
    } finally {
      indexedDB.open = orig;
      A.store.reopen();
    }
  })()`);
  check('openDB 失败后下一次调用会重试（不永久缓存 null）',
    dbRetry.firstFailed === true && dbRetry.retried === true && dbRetry.secondOk === true, dbRetry);

  // 15) 撤销评分回退 daily / stat / 会话，并立即落盘
  const undoDaily = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    // 内容里带唯一标记：卡片 id 是内容哈希，避免和前面测试的 deck 共享同一份 stat
    var uniq = 'U' + Date.now();
    var md = '## 一\\n\\n第一段内容 ' + uniq + '\\n\\n## 二\\n\\n第二段内容 ' + uniq + '\\n\\n## 三\\n\\n第三段内容 ' + uniq + '\\n\\n## 四\\n\\n第四段内容 ' + uniq;
    A.importText('idb-undo', md, { mode: 'h2' }, { silent: true, replace: 'yes' });
    var deck = A.state().decks.filter(function (d) { return d.name === 'idb-undo'; })[0];
    function dk() {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    var key = dk();
    var before = A.state().daily[key] || 0;
    A.startReview([deck.id], { resumeOk: true });
    var cardId = A.state().reviewSession.currentId;
    var statBefore = (A.state().stats[cardId] || {}).n || 0;
    A.showAnswer();
    A.rate('ok');
    await A.flushSave();
    var afterRate = A.state().daily[key] || 0;
    var statAfterRate = (A.state().stats[cardId] || {}).n || 0;
    A.undoRate();
    await A.flushSave();
    var raw = JSON.parse(await A.readRawState());
    return {
      cards: deck.cards.length,
      dailyBefore: before,
      afterRate: afterRate,
      afterUndo: A.state().daily[key] || 0,
      persistedDaily: raw.daily ? (raw.daily[key] || 0) : 0,
      statBefore: statBefore,
      statAfterRate: statAfterRate,
      statN: (A.state().stats[cardId] || {}).n || 0,
      persistedStatN: (raw.stats[cardId] || {}).n || 0,
      currentIdBack: A.state().reviewSession ? A.state().reviewSession.currentId : null,
      cardId: cardId
    };
  })()`);
  check('撤销评分回退 daily/stat/会话并落盘',
    undoDaily.cards >= 2 && undoDaily.afterRate === undoDaily.dailyBefore + 1 &&
    undoDaily.afterUndo === undoDaily.dailyBefore && undoDaily.persistedDaily === undoDaily.dailyBefore &&
    undoDaily.statAfterRate === undoDaily.statBefore + 1 && undoDaily.statN === undoDaily.statBefore &&
    undoDaily.persistedStatN === undoDaily.statBefore &&
    undoDaily.currentIdBack === undoDaily.cardId, undoDaily);

  // 16) 坏的图片记录（有键无 blob）不能中断导入：直接覆盖
  const corruptImg = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    await A.setCorruptImgForTest('corrupt-probe.png');
    var nm = await A.storeImageForTest('corrupt-probe.png', [1, 2, 3, 4, 5]);
    var type = await A.imgBlobTypeForTest('corrupt-probe.png');
    return { nm: nm, type: type };
  })()`);
  check('坏图片记录（无 blob）不中断导入、直接覆盖',
    corruptImg.nm === 'corrupt-probe.png' && corruptImg.type === 'image/png', corruptImg);

  // 17) 防御性 prune：确实评完（rated>=total）但残留 currentId 的会话会被清掉；合法暂停不受影响
  const pruneGuard = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    function sess(rated, total, currentId) {
      return {
        deckIds: [], filter: 'all', deckName: 'prune-deck', phase: 1,
        total: total, rated: rated, okCount: rated, fuzzyCount: 0, badCount: 0,
        queueIds: [], round2Ids: [], currentId: currentId, undo: null, savedAt: Date.now()
      };
    }
    // 合法暂停：最后一张待评（rated=total-1, currentId 有值）→ 必须留着
    A.state().reviewSession = sess(3, 4, 'pending-card');
    A.renderHome();
    var legitKept = !!A.state().reviewSession;
    // 评完后残留：rated=total，其余全空，只剩 currentId → 清掉并落盘
    A.state().reviewSession = sess(4, 4, 'finished-card');
    A.renderHome();
    await A.flushSave();
    var raw = JSON.parse(await A.readRawState());
    return {
      legitKept: legitKept,
      memAfterFinish: A.state().reviewSession,
      persistedAfterFinish: raw.reviewSession
    };
  })()`);
  check('防御 prune：评完残留被清、合法暂停保留',
    pruneGuard.legitKept === true && pruneGuard.memAfterFinish === null &&
    pruneGuard.persistedAfterFinish === null, pruneGuard);

  // 18) 图片入库异常时 addQueueFiles 仍要渲染队列（不能被 rejection 卡死）
  const importReject = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    A.openImportModal();
    var mdFile = new File([new TextEncoder().encode('# 笔记\\n\\n内容内容内容')], 'rej.md', { type: 'text/markdown' });
    var bad = new File([new Uint8Array([1, 2, 3])], 'bad.png', { type: 'image/png' });
    // 让读取相对路径时抛错，制造 importImageFiles 的 rejection
    Object.defineProperty(bad, 'webkitRelativePath', { get: function () { throw new Error('boom'); } });
    A.addQueueFiles([mdFile, bad]);
    await new Promise(function (r) { setTimeout(r, 400); });
    var list = document.getElementById('impList');
    return {
      queueLen: A.importQueue().length,
      listText: list ? list.textContent : '(no list)',
      rendered: !!list && list.textContent.indexOf('rej') >= 0
    };
  })()`);
  check('图片入库抛错时队列仍渲染（不卡死）',
    importReject.queueLen === 1 && importReject.rendered === true, importReject);

  // 19) v1.12.15：洗牌后答案必须能重新显示并评分（renderCard 要同步内部 revealed）
  const revealReshuffle = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var md = '## 甲\\n\\n洗牌甲内容，长度足够。\\n\\n## 乙\\n\\n洗牌乙内容，长度足够。\\n\\n## 丙\\n\\n洗牌丙内容，长度足够。';
    A.importText('idb-reshuffle', md, { mode: 'h2' }, { silent: true, replace: 'yes' });
    var deck = A.state().decks.filter(function (d) { return d.name === 'idb-reshuffle'; })[0];
    A.startReview([deck.id], { resumeOk: true });
    A.showAnswer();
    var beforeAnswered = !document.getElementById('rvAnswer').classList.contains('hidden');
    var beforeRated = A.state().reviewSession.rated;
    document.querySelector('[data-act="reshuffle"]').click();
    await new Promise(function (r) { setTimeout(r, 80); });
    var afterReshuffle = {
      answerHidden: document.getElementById('rvAnswer').classList.contains('hidden'),
      showVisible: !document.getElementById('btnShow').classList.contains('hidden'),
      rateHidden: document.getElementById('rateRow').classList.contains('hidden')
    };
    document.querySelector('[data-act="show-answer"]').click();
    await new Promise(function (r) { setTimeout(r, 40); });
    var reopened = !document.getElementById('rvAnswer').classList.contains('hidden');
    document.querySelector('[data-act="rate"][data-rate="ok"]').click();
    await new Promise(function (r) { setTimeout(r, 80); });
    var afterRated = A.state().reviewSession ? A.state().reviewSession.rated : -1;
    A.state().reviewSession = null;
    A.renderHome();
    return {
      cards: deck.cards.length, beforeAnswered: beforeAnswered, beforeRated: beforeRated,
      afterReshuffle: afterReshuffle, reopened: reopened, afterRated: afterRated
    };
  })()`);
  check('洗牌后答案重置：可再次显示并正常评分',
    revealReshuffle.cards >= 3 && revealReshuffle.beforeAnswered === true &&
    revealReshuffle.afterReshuffle.answerHidden === true &&
    revealReshuffle.afterReshuffle.showVisible === true &&
    revealReshuffle.afterReshuffle.rateHidden === true &&
    revealReshuffle.reopened === true &&
    revealReshuffle.afterRated === revealReshuffle.beforeRated + 1, revealReshuffle);

  // 20) v1.12.15：AI 导入同名笔记必须先确认；取消时旧卡与进度都不能丢
  const aiDupConfirm = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var name = 'ai-dup-probe';
    function payload(answer) {
      return JSON.stringify({ decks: [{ name: name, cards: [{ title: '标题', answer: answer }] }] });
    }
    function deck() {
      return A.state().decks.filter(function (d) { return d.name === name; })[0];
    }
    A.importCardsJson(payload('旧答案内容'));
    var first = deck() ? deck().cards[0].answer : null;
    var calls = 0, answer = false;
    var orig = window.confirm;
    window.confirm = function () { calls++; return answer; };
    var afterNo = null, afterYes = null;
    try {
      A.importCardsJson(payload('新答案内容'));
      afterNo = deck() ? deck().cards[0].answer : null;
      answer = true;
      A.importCardsJson(payload('新答案内容'));
      afterYes = deck() ? deck().cards[0].answer : null;
    } finally {
      window.confirm = orig;
    }
    var count = A.state().decks.filter(function (d) { return d.name === name; }).length;
    return { first: first, calls: calls, afterNo: afterNo, afterYes: afterYes, count: count };
  })()`);
  check('AI 导入同名笔记需确认：取消保留旧内容，确认才替换',
    aiDupConfirm.first === '旧答案内容' && aiDupConfirm.calls >= 2 &&
    aiDupConfirm.afterNo === '旧答案内容' && aiDupConfirm.afterYes === '新答案内容' &&
    aiDupConfirm.count === 1, aiDupConfirm);

  // 21) v1.12.15：导入文件里的 deck/card id 不能逃出 data 属性（首页 + 浏览 + 弹窗）
  const attrEscape = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var deckId = 'd"><img src=x onerror="window.__xssDeck=1">';
    var cardId = 'c"><svg onload="window.__xssCard=1"></svg>';
    A.state().settings.filter = 'all';
    A.state().settings.tagFilter = '';
    A.state().decks.push({
      id: deckId, name: 'evil-probe', title: 'evil', createdAt: Date.now(),
      mode: 'x', qstyle: 'prompt', raw: '',
      cards: [{ id: cardId, title: '恶意卡', question: '', answer: '正文内容，长度足够。' }]
    });
    A.renderHome();
    await new Promise(function (r) { setTimeout(r, 120); });
    var deckBox = Array.prototype.filter.call(document.querySelectorAll('#deckList .deck'), function (el) {
      var n = el.querySelector('.deck-name');
      return n && n.textContent === 'evil-probe';
    })[0];
    var browseBtn = deckBox ? deckBox.querySelector('[data-act="browse"]') : null;
    var home = {
      injected: document.querySelectorAll('#deckList img, #deckList svg').length,
      deckAttr: browseBtn ? browseBtn.getAttribute('data-deck') : null
    };
    if (browseBtn) browseBtn.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    var item = document.querySelector('#cardList .citem');
    var browse = {
      injected: document.querySelectorAll('#cardList img, #cardList svg').length,
      cardAttr: item ? item.getAttribute('data-card') : null,
      items: document.querySelectorAll('#cardList .citem').length
    };
    if (item) item.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    var modal = {
      open: !document.getElementById('modal').classList.contains('hidden'),
      answer: document.getElementById('editAnswer') ? document.getElementById('editAnswer').value : null
    };
    var close = document.querySelector('#modalBox [data-act="close-modal"]');
    if (close) close.click();
    A.state().decks = A.state().decks.filter(function (d) { return d.id !== deckId; });
    A.renderHome();
    return {
      xss: [!!window.__xssDeck, !!window.__xssCard],
      home: home, browse: browse, modal: modal, deckId: deckId, cardId: cardId
    };
  })()`);
  check('恶意 deck/card id 被转义：不注入 DOM，data 属性仍可回读原值',
    attrEscape.xss[0] === false && attrEscape.xss[1] === false &&
    attrEscape.home.injected === 0 && attrEscape.home.deckAttr === attrEscape.deckId &&
    attrEscape.browse.injected === 0 && attrEscape.browse.cardAttr === attrEscape.cardId &&
    attrEscape.browse.items === 1 && attrEscape.modal.open === true &&
    attrEscape.modal.answer === '正文内容，长度足够。', attrEscape);

  // 22) v1.12.15：浏览页编辑弹窗里的图片也能点开大图
  const modalImgClick = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#0af"/></svg>';
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(svg));
    await A.setImgForTest('click-probe.svg', bytes);
    var idx = await A.imgIndexNames();
    if (idx.indexOf('click-probe.svg') < 0) await A.setImgIndexForTest(idx.concat(['click-probe.svg']));
    await A.loadStoredImages();
    A.importText('click-probe', '## 看图\\n\\n看图：![](click-probe.svg) 这是内容。', { mode: 'h2' }, { silent: true, replace: 'yes' });
    var deck = A.state().decks.filter(function (d) { return d.name === 'click-probe'; })[0];
    A.renderHome();
    var deckBox = Array.prototype.filter.call(document.querySelectorAll('#deckList .deck'), function (el) {
      var n = el.querySelector('.deck-name');
      return n && n.textContent === 'click-probe';
    })[0];
    deckBox.querySelector('[data-act="browse"]').click();
    await new Promise(function (r) { setTimeout(r, 80); });
    var item = document.querySelector('#cardList .citem');
    item.click();
    await new Promise(function (r) { setTimeout(r, 80); });
    var img = document.querySelector('#modalBox img');
    var src = img ? img.getAttribute('src') : '';
    var opened = false;
    if (img) {
      img.click();
      await new Promise(function (r) { setTimeout(r, 120); });
      opened = !document.getElementById('imgViewer').classList.contains('hidden') &&
        !!document.querySelector('#imgViewer img');
    }
    A.closeImageViewer();
    var close = document.querySelector('#modalBox [data-act="close-modal"]');
    if (close) close.click();
    A.state().decks = A.state().decks.filter(function (d) { return d.id !== deck.id; });
    A.renderHome();
    return { hasImg: !!img, blob: /^blob:/.test(src), opened: opened };
  })()`);
  check('浏览页/编辑弹窗图片可点开大图（#modalBox img）',
    modalImgClick.hasImg === true && modalImgClick.blob === true &&
    modalImgClick.opened === true, modalImgClick);

  // 23) v1.12.15：文件夹里不同子目录的同名笔记按文件夹区分，不再互相覆盖
  const dupFolders = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    function mk(name, rel, text) {
      var f = new File([new TextEncoder().encode(text)], name, { type: 'text/markdown' });
      Object.defineProperty(f, 'webkitRelativePath', { value: rel });
      return f;
    }
    var mdA = '# 甲\\n\\n## 小节\\n\\n甲文件夹里的唯一一段内容，长度足够。';
    var mdB = '# 乙\\n\\n## 小节\\n\\n乙文件夹里的唯一一段内容，长度足够。';
    var orig = window.confirm;
    window.confirm = function () { return true; };
    var listed = [];
    try {
      A.openImportModal();
      A.addQueueFiles([mk('dup-note.md', 'root/a/dup-note.md', mdA), mk('dup-note.md', 'root/b/dup-note.md', mdB)]);
      await A.pendingImageWorkForTest();
      listed = Array.prototype.map.call(document.querySelectorAll('#impList .imp-name'), function (n) {
        return n.textContent.replace(/ · .*$/, '');
      });
      A.doImportQueue();
      var deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        var ds = A.state().decks;
        if (ds.some(function (d) { return d.name === 'a/dup-note'; }) &&
            ds.some(function (d) { return d.name === 'b/dup-note'; })) break;
        await new Promise(function (r) { setTimeout(r, 50); });
      }
    } finally {
      window.confirm = orig;
    }
    var a = A.state().decks.filter(function (d) { return d.name === 'a/dup-note'; })[0];
    var b = A.state().decks.filter(function (d) { return d.name === 'b/dup-note'; })[0];
    function body(d) { return d ? d.cards.map(function (c) { return c.answer; }).join('\\n') : ''; }
    return {
      listed: listed, a: !!a, b: !!b,
      aText: body(a).indexOf('甲文件夹') >= 0,
      bText: body(b).indexOf('乙文件夹') >= 0,
      oldStyleCount: A.state().decks.filter(function (d) { return d.name === 'dup-note'; }).length
    };
  })()`, 120000);
  check('文件夹导入：不同目录同名笔记按文件夹区分（a/…、b/…）',
    dupFolders.listed.indexOf('a/dup-note') >= 0 && dupFolders.listed.indexOf('b/dup-note') >= 0 &&
    dupFolders.a === true && dupFolders.b === true &&
    dupFolders.aText === true && dupFolders.bText === true &&
    dupFolders.oldStyleCount === 0, dupFolders);

  // 24) v1.12.15：备份 zip 被重新打包后 images/ 多一层前缀也要能恢复图片
  const nestedZip = await evalJs(`(async function () {
    var Core = window.MDReviewCore;
    var A = window.MDReviewApp;
    var enc = new TextEncoder();
    var nested = Core.zipStore([
      { name: 'pkg/backup.json', data: enc.encode(JSON.stringify({ version: '1.12.15', decks: [{ name: 'x', cards: [] }] })) },
      { name: 'pkg/images/nested-probe.png', data: new Uint8Array([1, 2, 3, 4, 5]) },
      { name: 'pkg/images/readme.md', data: enc.encode('not an image') },
      { name: 'pkg/notes/readme.md', data: enc.encode('hello') }
    ]);
    var root = Core.zipStore([
      { name: 'backup.json', data: enc.encode(JSON.stringify({ version: '1.12.15', decks: [] })) },
      { name: 'images/root-probe.png', data: new Uint8Array([9, 9]) }
    ]);
    var rn = await A.parseBackupBuffer(nested.buffer);
    var rr = await A.parseBackupBuffer(root.buffer);
    return {
      nested: rn.images.map(function (im) { return im.name; }),
      nestedBytes: rn.images.length ? Array.prototype.slice.call(rn.images[0].bytes) : [],
      hasObj: !!rn.obj,
      root: rr.images.map(function (im) { return im.name; })
    };
  })()`);
  check('备份 zip：images/ 在任意层级都能识别（根目录仍兼容）',
    nestedZip.hasObj === true && nestedZip.nested.length === 1 &&
    nestedZip.nested[0] === 'nested-probe.png' &&
    nestedZip.nestedBytes.join(',') === '1,2,3,4,5' &&
    nestedZip.root.length === 1 && nestedZip.root[0] === 'root-probe.png', nestedZip);

  // 25) v1.12.15：重试后仍解码失败 → 必须落到占位，不能留下 alt 大字
  const retryFail = await evalJs(`(async function () {
    var A = window.MDReviewApp;
    await A.setImgForTest('retry-bad.png', [137, 80, 78, 71, 0, 0, 0, 0]);
    var idx = await A.imgIndexNames();
    if (idx.indexOf('retry-bad.png') < 0) await A.setImgIndexForTest(idx.concat(['retry-bad.png']));
    await A.loadStoredImages();
    var host = document.createElement('div');
    host.innerHTML = '<img data-img="retry-bad.png" alt="retry-bad.png" src="data:text/plain;base64,PGh0bWw+YmFk">';
    document.body.appendChild(host);
    await new Promise(function (r) { setTimeout(r, 1500); });
    var chip = host.querySelector('.img-missing');
    var left = host.querySelector('img');
    var text = chip ? chip.textContent : '';
    host.remove();
    return {
      hasChip: !!chip, stillImg: !!left, hasName: text.indexOf('retry-bad.png') >= 0,
      hasUrl: !!A.imgUrls()['retry-bad.png']
    };
  })()`);
  check('图片二次解码失败仍显示占位（不留下 alt 大字）',
    retryFail.hasUrl === true && retryFail.hasChip === true &&
    retryFail.stillImg === false && retryFail.hasName === true, retryFail);

  // 收尾：清掉本组测试写入的图片探针
  await evalJs(`(async function () {
    var A = window.MDReviewApp;
    var extra = ['corrupt-probe.png', 'retry-bad.png', 'click-probe.svg'];
    var idx = await A.imgIndexNames();
    await A.setImgIndexForTest(idx.filter(function (n) { return extra.indexOf(n) < 0; }));
    for (var i = 0; i < extra.length; i++) { try { await A.rawDeleteForTest('img/' + extra[i]); } catch (e) {} }
    var decks = ['idb-reshuffle', 'ai-dup-probe', 'evil-probe', 'click-probe', 'a/dup-note', 'b/dup-note'];
    A.state().decks = A.state().decks.filter(function (d) { return decks.indexOf(d.name) < 0; });
    A.state().reviewSession = null;
    A.renderHome();
    return true;
  })()`).catch(() => null);

  ws.close();
  proc.kill();

  const bad = results.filter((r) => !r.ok);
  console.log('\nIDB 真实时钟测试：' + (results.length - bad.length) + ' / ' + results.length + (bad.length ? '（有失败）' : ' 通过'));
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => fail(e.message));
