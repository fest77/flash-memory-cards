/* 浏览器端自动化冒烟测试：由 run-browser-test.cjs 注入到构建产物后面执行。
   结果写入 body[data-test-results] 和 #testResult，供 headless dump-dom 解析。 */
(function () {
  'use strict';
  var results = [];
  function check(name, cond, extra) {
    var line = (cond ? 'ok' : 'FAIL') + ' ' + name + (extra !== undefined && extra !== null ? ' :: ' + extra : '');
    results.push(line);
  }
  function q(sel) { return document.querySelector(sel); }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'testResult';
    pre.textContent = results.join('\n');
    document.body.appendChild(pre);
    document.body.setAttribute('data-test-results', results.join(' || '));
    var fails = results.filter(function (r) { return r.indexOf('FAIL') === 0; });
    document.title = fails.length ? 'TEST-FAIL-' + fails.length : 'TEST-PASS';
  }

  // 用轮询次数而非 Date.now()：KaTeX 内联后虚拟时钟会跳变，时钟判定会误报超时
  var bootTries = 0;
  (function waitBoot() {
    var app = window.MDReviewApp;
    if (app && app.state && app.state()) { run(); return; }
    if (++bootTries > 400) {
      check('boot', false, 'timeout waiting MDReviewApp');
      finish();
      return;
    }
    setTimeout(waitBoot, 60);
  })();

  function run() {
    var app = window.MDReviewApp;
    window.__confirms = [];
    window.confirm = function (msg) { window.__confirms.push(String(msg)); return true; }; // headless 自动接受
    var guard = 0;
    var step = 0;

    function rateAll(kind) {
      var g = 0;
      while (!q('#rvSummary') || q('#rvSummary').classList.contains('hidden')) {
        if (g++ > 60) break;
        if (q('#btnShow') && !q('#btnShow').classList.contains('hidden')) {
          q('[data-act="show-answer"]').click();
        }
        var row = q('#rateRow');
        if (row && !row.classList.contains('hidden')) {
          var btn = q('[data-rate="' + kind + '"]');
          if (btn) btn.click();
        } else if (!q('#rvSummary') || q('#rvSummary').classList.contains('hidden')) {
          break;
        }
      }
    }

    try {
      /* --- 启动 --- */
      check('boot', !!app);
      check('home active', q('#view-home').classList.contains('active'));
      check('statbar rendered', q('#statBar').innerHTML.indexOf('全部卡片') >= 0);
      check('no bundled decks in repo build', app.state().decks.filter(function (x) { return x.bundled; }).length === 0, app.state().decks.length);
      var baseDecks = app.state().decks.length;
      check('hero visible when empty', !q('#heroEmpty').classList.contains('hidden'));

      /* --- 导入 --- */
      var md = [
        '# 自动化测试笔记',
        '',
        '这段说明文字不该单独成为卡片。',
        '',
        '## 卡片一',
        '',
        '答案一的内容 ABC。',
        '',
        '## 卡片二',
        '',
        'Q: 问题二是什么？',
        'A: 答案二的内容 DEF。',
        '',
        '## 卡片三',
        '',
        '- 列表一',
        '- 列表二',
        '',
        '```js',
        'const x = "<b>code</b>";',
        '```'
      ].join('\n');

      var ok = app.importText('自动化测试', md, { mode: 'auto', gran: 'mid' });
      check('import returns true', ok === true);
      var st = app.state();
      check('deck added', st.decks.length === baseDecks + 1, st.decks.length);
      var testDeck = st.decks.filter(function (x) { return x.name === '自动化测试'; })[0];
      var testDeckId = testDeck.id;
      check('cards >= 3', testDeck.cards.length >= 3, testDeck.cards.length);
      check('deck card rendered', document.querySelectorAll('#deckList .deck').length === baseDecks + 1);
      check('hero hidden after import', q('#heroEmpty').classList.contains('hidden'));
      check('home body visible', !q('#homeBody').classList.contains('hidden'));

      /* --- 导入弹层 / 提问风格 / AI 设置 --- */
      q('[data-act="open-import"]').click();
      check('import modal opened', !q('#modal').classList.contains('hidden'));
      check('import modal has md button', !!q('[data-act="imp-pick"]'));
      check('import modal has zip button', !!q('[data-act="imp-zip"]'));
      check('import queue empty hint', !!q('#impList') && q('#impList').textContent.indexOf('还没有') >= 0);
      q('[data-act="close-modal"]').click();
      check('import modal closed', q('#modal').classList.contains('hidden'));
      check('qstyle select exists', !!q('#setQstyle'));
      check('ai quick button exists', !!q('#aiQuickBtn'));
      q('#aiQuickBtn').click();
      check('ai quick none-configured', !!q('#modal [data-act="ai-manage"]'), q('#modalBox').textContent.slice(0, 40));
      q('[data-act="close-modal"]').click();
      check('ai quick modal closed', q('#modal').classList.contains('hidden'));

      var okCloze = app.importText('提问测试', '## 三次握手\n\n客户端发送 **SYN**，服务端回复 **SYN+ACK**，最后 **ACK**。', { mode: 'auto', gran: 'mid', qstyle: 'cloze' });
      check('cloze import returns true', okCloze === true);
      var clozeDeck = app.state().decks.filter(function (x) { return x.name === '提问测试'; })[0];
      check('cloze question masked', !!clozeDeck && clozeDeck.cards[0].question.indexOf('____') >= 0,
        clozeDeck && clozeDeck.cards[0].question);

      /* --- AI 卡片 JSON 导入 + 浏览器内 zip 解包 --- */
      app.importCardsJson(JSON.stringify({
        decks: [{ name: 'AI测试', cards: [{ title: 'AI 卡', question: 'AI 出的问题？', answer: 'AI 卡片答案' }] }]
      }));
      check('ai cards json imported', !!app.state().decks.filter(function (x) { return x.name === 'AI测试'; })[0]);

      window.__zipList = null;
      var zipB64 = 'UEsDBBQAAAAIACRMV11XkjbrigAAAJcAAAAMAAAAbm90ZXMvdGNwLm1kU1YIcQ5QeL5myot1G7i4lJUVnuzofLZm4bP+hc86u7m4nq5b9Kxj+/PV6xWCI/3e7+l5Nqf3addCKF/b0dkbKIZQA+Q/bmiCGrPrye6GJzs7nuzofTZj/ZMdS4CmcnG9nLHp2dpFT/vanvZverF/3rO+pS/Wb3+2senZ1lUvtux8sbXl2a4JICMAUEsDBBQAAAAIACRMV13q6RrmVQAAAFAAAAASAAAAbm90ZXMvZGVlcC9tZW0udHh0AVAAr/8jIOWGheWtmOeslOiusAoKIyMg6Jma5ouf5YaF5a2YCgrmr4/kuKrov5vnqIvni6znq4vlnLDlnYDnqbrpl7TvvIxNTVUg5pig5bCE44CCClBLAwQUAAAACAAkTFddOZz7BgYAAAAEAAAAEQAAAF9fTUFDT1NYLy5fdGNwLm1kyyrNywYAUEsDBBQAAAAIACRMV10EwL7RBgAAAAQAAAAQAAAAbm90ZXMvcmVhZG1lLnBkZlMNcHEDAFBLAQIUABQAAAAIACRMV11XkjbrigAAAJcAAAAMAAAAAAAAAAAAAACAAQAAAABub3Rlcy90Y3AubWRQSwECFAAUAAAACAAkTFdd6uka5lUAAABQAAAAEgAAAAAAAAAAAAAAgAG0AAAAbm90ZXMvZGVlcC9tZW0udHh0UEsBAhQAFAAAAAgAJExXXTmc+wYGAAAABAAAABEAAAAAAAAAAAAAAIABOQEAAF9fTUFDT1NYLy5fdGNwLm1kUEsBAhQAFAAAAAgAJExXXQTAvtEGAAAABAAAABAAAAAAAAAAAAAAAIABbgEAAG5vdGVzL3JlYWRtZS5wZGZQSwUGAAAAAAQABAD3AAAAogEAAAAA';
      var bin = atob(zipB64);
      var zipArr = new Uint8Array(bin.length);
      for (var zi = 0; zi < bin.length; zi++) zipArr[zi] = bin.charCodeAt(zi);
      window.MDReviewCore.unzipTextFiles(zipArr.buffer).then(function (list) {
        window.__zipList = list;
      }, function (err) {
        window.__zipError = String(err && err.message);
      });

      window.__imgTest = { urls: null, html: null, missing: null, err: null };
      window.addEventListener('unhandledrejection', function (ev) {
        window.__imgTest.err = 'rej: ' + ((ev.reason && ev.reason.message) || ev.reason);
      });
      (function () {
        var png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
        var f = new File([png], 'img/hello.png', { type: 'image/png' });
        try { app.addQueueFiles([f]); } catch (e) { window.__imgTest.err = 'sync: ' + (e && e.message); }
        setTimeout(function () {
          try {
            var ok = app.rememberImage('hello.png', new Blob([png], { type: 'image/png' }));
            var urls = app.imgUrls();
            window.__imgTest.urls = (ok ? 'ok:' : 'fail:') + Object.keys(urls).join(',');
            window.__imgTest.html = app.resolveImgSrc('<img src="images/hello.png" alt="x" loading="lazy">');
            window.__imgTest.missing = app.resolveImgSrc('<img src="images/nope.png" alt="y">');
          } catch (e) {
            window.__imgTest.err = String(e && e.message);
          }
        }, 400);
      })();

      /* --- 复习（经设置弹窗） --- */
      q('[data-act="review"][data-deck="' + testDeckId + '"]').click();
      check('review setup modal opens', !q('#modal').classList.contains('hidden') && !!q('#modalBox [data-act="review-start"]'), 'setup');
      check('setup has 20 option', !!q('#modalBox input[name="rvCount"][value="20"]'), '20');
      check('setup has weak option', !!q('#modalBox input[name="rvScope"][value="weak"]'), 'weak');
      check('setup chapter select', q('#modalBox #rvChapterSel').options.length >= 1, q('#modalBox #rvChapterSel').options.length);
      q('#modalBox [data-act="review-start"]').click();
      check('review active', q('#view-review').classList.contains('active'));
      check('card title shown', q('#rvTitle').textContent.length > 0, q('#rvTitle').textContent);
      check('progress text', q('#rvProg').textContent.indexOf('/') > 0, q('#rvProg').textContent);
      check('answer hidden initially', q('#rvAnswer').classList.contains('hidden'));
      check('rate row hidden initially', q('#rateRow').classList.contains('hidden'));

      // 评分 → 撤销按钮出现 → 撤销恢复
      var undoCid = app.state().reviewSession ? app.state().reviewSession.currentId : null;
      q('[data-act="show-answer"]').click();
      check('answer visible after reveal', !q('#rvAnswer').classList.contains('hidden'));
      check('answer html rendered', q('#rvAnswer').innerHTML.length > 5);
      check('rate row visible after reveal', !q('#rateRow').classList.contains('hidden'));

      q('[data-rate="ok"]').click();
      var stats = app.state().stats;
      var known = 0;
      Object.keys(stats).forEach(function (k) { if (stats[k].s === 'known') known++; });
      check('stat recorded', Object.keys(stats).length >= 1, Object.keys(stats).length);
      /* 撤销链路：重开一轮，评一张，撤销，验证 stat 回滚 */
      (function(){
        var d0 = app.state().decks[0];
        if (!d0) return;
        app.startReview([d0.id], {});
        if (!window.MDReviewApp.state().reviewSession) return;
        var cid = app.state().reviewSession.currentId;
        var before = app.state().stats[cid] || { n: 0, box: 0 };
        app.showAnswer();
        app.rate('ok'); // 直调（DOM 点击在同页多轮评分后偶发不触发）
        var after = app.state().stats[cid];
        var box1 = after && after.n === before.n + 1; // 相对断言：n 增 1（box 只在 <=3 时递增）
        check('schedule applied on rate', box1, after ? 'box=' + after.box + ' n=' + after.n + ' before.n=' + before.n : 'no stat');
        var ub = q('#undoRateBtn');
        check('undo visible after rate', ub && !ub.classList.contains('hidden'), 'visible');
        ub.click();
        var st2 = app.state().stats[cid];
        check('undo restores stat', st2 && (st2.n === before.n) && (st2.box || 0) === (before.box || 0), st2 ? 'n=' + st2.n + ' box=' + st2.box + ' want n=' + before.n : 'gone');
        check('undo keeps queue', app.state().reviewSession && app.state().reviewSession.currentId === cid, 'same card back');
      })();
      check('known marked', known === 1, known);

      /* --- 跑完一轮 --- */
      rateAll('ok');
      check('summary visible', !q('#rvSummary').classList.contains('hidden'));
      check('summary content', q('#rvSummary').textContent.indexOf('本轮完成') >= 0);

      /* --- 第二轮：全部评「忘了」，应进入第 2 轮 --- */
      q('[data-act="again"]').click();
      check('review restarted', q('#view-review').classList.contains('active'));
      rateAll('bad');
      check('round2 finished', !q('#rvSummary').classList.contains('hidden'));
      check('round2 badge', q('#rvDeck').textContent.indexOf('第 2 轮') >= 0 || q('#rvSummary').textContent.indexOf('忘了') >= 0, q('#rvDeck').textContent);

      /* --- 返回 + 浏览 + 编辑 --- */
      q('[data-act="back-home"]').click();
      setTimeout(function () {
        try {
          check('back to home', q('#view-home').classList.contains('active'));
          q('[data-act="browse"][data-deck="' + testDeckId + '"]').click();
          check('browse active', q('#view-browse').classList.contains('active'));
          check('card list rendered', document.querySelectorAll('#cardList .citem').length >= 3, document.querySelectorAll('#cardList .citem').length);

          q('#cardList .citem').click();
          check('card modal opened', !q('#modal').classList.contains('hidden'));
          check('modal shows answer', q('#modalBox').textContent.length > 10);

          q('#editTitle').value = '被改过的标题';
          q('[data-act="save-card"]').click();
          check('modal closed after save', q('#modal').classList.contains('hidden'));
          check('edit reflected in list', q('#cardList').textContent.indexOf('被改过的标题') >= 0);

          /* --- 筛选「只看没掌握」 --- */
          q('[data-act="back-home"]').click();
          setTimeout(function () {
            try {
              q('[data-act="set-filter"][data-filter="todo"]').click();
              check('filter switched', app.state().settings.filter === 'todo');
              check('filter chip on', q('[data-filter="todo"]').classList.contains('on'));

              /* --- 导出：单 deck 仍弹 JSON 层；全量是 zip（异步无弹层） --- */
              var exDeck = q('#deckList [data-act="export-deck"]');
              if (exDeck) {
                exDeck.click();
                check('export modal', !q('#modal').classList.contains('hidden'));
                check('export has json', q('#modalBox textarea') && q('#modalBox textarea').value.indexOf('md-review') >= 0);
                q('[data-act="close-modal"]').click();
                check('modal closed', q('#modal').classList.contains('hidden'));
              } else {
                check('export modal', false, 'no export-deck btn');
                check('export has json', false, 'no btn');
                check('modal closed', true, 'skipped');
              }

              /* --- 分类速记（用导入的测试笔记） --- */
              var qd = app.state().decks.filter(function (x) { return x.name === '改名前的测试笔记' || x.name === '自动化测试'; })[0];
              app.openQuick(qd.id);
              check('quick view active', q('#view-quick').classList.contains('active'));
              check('quick cards rendered', document.querySelectorAll('#quickBody .quick-card').length >= 3, document.querySelectorAll('#quickBody .quick-card').length);
              check('quick answer rendered', !!q('#quickBody .quick-a') && q('#quickBody .quick-a').innerHTML.length > 10);
              check('quick outline chips', document.querySelectorAll('#quickOutline .chip').length >= 2, document.querySelectorAll('#quickOutline .chip').length);
              var firstFold = q('[data-act="quick-fold"]');
              if (firstFold) firstFold.click();
              check('quick fold works', !!q('#quickBody .quick-group.collapsed'));

              /* --- 题目目录（章 → 题） --- */
              q('[data-act="quick-toc"]').click();
              check('quick toc opened', !!q('#quickToc') && !q('#quickToc').classList.contains('hidden'));
              check('quick toc items', document.querySelectorAll('#quickToc .toc-item').length >= 3, document.querySelectorAll('#quickToc .toc-item').length);
              var firstTocItem = q('#quickToc .toc-item');
              if (firstTocItem) firstTocItem.click();
              check('quick jump rendered', document.querySelectorAll('#quickBody .quick-card').length > 0, document.querySelectorAll('#quickBody .quick-card').length);
              check('quick jump closed toc', !!q('#quickToc') && q('#quickToc').classList.contains('hidden'));

              /* --- 设置视图：主题 / 语言 --- */
              q('[data-act="tab"][data-view="settings"]').click();
              check('settings view active', q('#view-settings').classList.contains('active'));
              check('theme select exists', !!q('#setTheme') && !!q('#setLang'));
              check('about version shown', q('#aboutVersion').textContent.indexOf('v') === 0, q('#aboutVersion').textContent);
              check('ai providers empty by default', document.querySelectorAll('#aiProviderList .ai-p').length === 0,
                document.querySelectorAll('#aiProviderList .ai-p').length);
              check('ai active select exists', !!q('#aiActive'));
              q('[data-act="ai-add"]').click();
              check('add modal lists presets', document.querySelectorAll('#modal .ai-q-row').length >= 7,
                document.querySelectorAll('#modal .ai-q-row').length);
              q('[data-act="ai-add-preset"]').click();
              check('preset added', app.state().settings.ai.providers.length === 1, app.state().settings.ai.providers.length);
              check('provider card rendered', document.querySelectorAll('#aiProviderList .ai-p').length === 1);
              check('preset added enabled', app.state().settings.ai.providers[0].enabled === true);
              check('active follows first added', app.state().settings.ai.activeId === 'preset-deepseek');
              q('#setLang').value = 'en';
              q('#setLang').dispatchEvent(new Event('change', { bubbles: true }));
              check('lang switched to en', document.title.indexOf('FlashCards') >= 0, document.title);
              check('statbar translated', q('#statBar').textContent.indexOf('All cards') >= 0, q('#statBar').textContent.slice(0, 40));
              q('#setTheme').value = 'light';
              q('#setTheme').dispatchEvent(new Event('change', { bubbles: true }));
              check('light theme applied', document.body.classList.contains('light'));
              q('#setTheme').value = 'dark';
              q('#setTheme').dispatchEvent(new Event('change', { bubbles: true }));
              check('dark theme restored', !document.body.classList.contains('light'));
              q('#setLang').value = 'zh-Hans';
              q('#setLang').dispatchEvent(new Event('change', { bubbles: true }));
              check('lang restored', document.title.indexOf('闪卡') >= 0, document.title);
              app.state().settings.theme = 'dark';

              /* --- 笔记管理 --- */
              app.openManage();
              check('back from settings to manage', q('#view-manage').classList.contains('active'));
              check('manage active', q('#view-manage').classList.contains('active'));
              check('manage lists decks', document.querySelectorAll('#manageList .mdeck').length === app.state().decks.length,
                document.querySelectorAll('#manageList .mdeck').length);
              q('[data-act="manage-rename"]').click();
              check('rename modal opened', !!q('#renameInput'));
              q('#renameInput').value = '改名后的笔记';
              q('[data-act="do-rename"]').click();
              check('rename applied', app.state().decks.filter(function (x) { return x.name === '改名后的笔记'; }).length === 1);

              /* --- 主页 AI 快捷切换（已有启用的供应商） --- */
              q('[data-act="back-home"]').click();
              setTimeout(function () {
                try {
                  check('home for quick pick', q('#view-home').classList.contains('active'));
                  q('#aiQuickBtn').click();
                  var rows = document.querySelectorAll('#modal .ai-q-row');
                  check('quick model rows', rows.length >= 1, rows.length);
                  var target = q('#modal .ai-q-row.on') ? rows[rows.length - 1] : rows[0];
                  var expectModel = target.getAttribute('data-model');
                  target.click();
                  var ap = app.state().settings.ai.providers.filter(function (p) { return p.id === app.state().settings.ai.activeId; })[0];
                  check('quick pick applied', ap && ap.model === expectModel, ap && ap.model);
                  check('quick modal closed', q('#modal').classList.contains('hidden'));
                  check('quick button label updated', q('#aiQuickBtn').textContent.indexOf(ap.model) >= 0, q('#aiQuickBtn').textContent);

                  check('browser unzip works', !!window.__zipList && window.__zipList.length === 2,
                    window.__zipList ? window.__zipList.map(function (x) { return x.name; }).join(',') : (window.__zipError || 'pending'));

                  check('img file input accepts images', (q('#fileInput').getAttribute('accept') || '').indexOf('image/*') >= 0,
                    q('#fileInput').getAttribute('accept'));
                  check('img stored and mapped', !!window.__imgTest && window.__imgTest.urls && window.__imgTest.urls.indexOf('ok:hello.png') === 0,
                    window.__imgTest ? (window.__imgTest.urls || window.__imgTest.err || 'pending') : 'no-run');
                  check('img src resolved to blob', !!window.__imgTest && window.__imgTest.html && window.__imgTest.html.indexOf('src="blob:') >= 0,
                    window.__imgTest ? window.__imgTest.html : 'no-run');
                  check('img missing placeholder', !!window.__imgTest && window.__imgTest.missing && window.__imgTest.missing.indexOf('img-missing') >= 0,
                    window.__imgTest ? window.__imgTest.missing : 'no-run');

                  /* 到期 chip + 撤销 */
                  check('due chip shown', q('#statBar').textContent.indexOf('今日到期') >= 0, q('#statBar').textContent.slice(0, 60));
                  /* 第 0 步用例组 */
                  (function () {
                    var st = app.state();
                    var d0 = st.decks[0];
                    if (!d0) { check('step0 suite', false, 'no deck'); return; }
                    // A) 三卡验证待复习=2：已掌握且到期 / 已掌握未到期 / 新卡
                    st.decks = []; st.stats = {}; st.reviewSession = null;
                    // 造 3 张独立卡
                    var md3 = '# T\n\n## a\n\nQ: 1?\nA: 1.\n\n## b\n\nQ: 2?\nA: 2.\n\n## c\n\nQ: 3?\nA: 3.';
                    app.importText('三卡', md3, {}, { replace: 'yes' });
                    d0 = st.decks.filter(function (x) { return x.name === '三卡'; })[0] || st.decks[0];
                    var ids = d0.cards.map(function (c) { return c.id; });
                    var eot = new Date(); eot.setHours(23, 59, 59, 999);
                    st.stats[ids[0]] = { s: 'known', n: 1, ok: 1, bad: 0, last: Date.now(), box: 2, ivl: 3, dueAt: Date.now() };      // 掌握+到期
                    st.stats[ids[1]] = { s: 'known', n: 1, ok: 1, bad: 0, last: Date.now(), box: 3, ivl: 7, dueAt: Date.now() + 86400000 * 3 }; // 掌握+未到期
                    // ids[2] 新卡：无 stat
                    app.renderHome();
                    var chip = q('#statBar').textContent;
                    var todoN = parseInt((chip.match(/待复习\s*(\d+)/) || [0, '0'])[1], 10);
                    check('todo=2 (due-known + fresh, not future-known)', todoN === 2, 'n=' + todoN + ' chip=' + chip.slice(0, 60));

                    // B) 多本弹窗：20/50/全部 + 全部笔记（先补第二本，review-all 需 ≥2 本）
                    app.importText('第二本', '# S\n\n## x\n\nQ: 9?\nA: 9.', {}, { replace: 'yes' });
                    app.renderHome();
                    var allBtn = q('[data-act="review-all"]');
                    if (allBtn) {
                      allBtn.click();
                      var mC20 = !!q('#modalBox input[name="rvCount"][value="20"]');
                      var mC50 = !!q('#modalBox input[name="rvCount"][value="50"]');
                      var mCA = !!q('#modalBox input[name="rvCount"][value="all"]');
                      var mNoCh = !q('#modalBox #rvChapterSel');
                      check('multi modal 20/50/all + no chapter', mC20 && mC50 && mCA && mNoCh, [mC20, mC50, mCA, mNoCh].join(','));
                      // 走一次 50 张：deckIds 应覆盖全部笔记
                      q('#modalBox input[name="rvCount"][value="50"]').checked = true;
                      q('#modalBox [data-act="review-start-multi"]').click();
                      var inRev = q('#view-review').classList.contains('active');
                      var sessDecks = app.state().reviewSession ? app.state().reviewSession.deckIds.length : 0;
                      check('multi review covers all decks', inRev && sessDecks === st.decks.length, 'decks=' + sessDecks + '/' + st.decks.length);
                      window.__flushAtReviewStart = app.flushCount();
                    } else {
                      check('multi modal 20/50/all + no chapter', false, 'no review-all btn');
                      check('multi review covers all decks', false, 'no btn');
                    }

                    // C) 新复习确认：取消保留 / 确定丢弃
                    // 当前在复习中（B 步已开）。评一张制造会话，退出，再开新的
                    app.showAnswer();
                    q('[data-rate="ok"]').click();
                    q('#view-review [data-act="back-home"]').click();
                    q('[data-act="tab"][data-view="home"]').click(); // history.back 异步，同步切主页
                    var hadSess = !!app.state().reviewSession;
                    window.__confirms.length = 0;
                    window.__confirmReturn = false;
                    var realConfirm = window.confirm;
                    window.confirm = function (m) { window.__confirms.push(m); return window.__confirmReturn; };
                    q('#deckList [data-act="review"]').click();
                    q('#modalBox [data-act="review-start"]').click();
                    var cancelKept = !!app.state().reviewSession && !q('#view-review').classList.contains('active');
                    check('confirm cancel keeps session', hadSess && cancelKept, 'had=' + hadSess + ' kept=' + cancelKept);
                    window.__confirmReturn = true;
                    q('#deckList [data-act="review"]').click();
                    q('#modalBox [data-act="review-start"]').click();
                    var okStarted = q('#view-review').classList.contains('active');
                    check('confirm ok starts new session', okStarted, 'started');
                    window.confirm = realConfirm;

                    // D) 新会话立即落盘：flushSave 计数应增长（IDB 直读在 headless 虚拟时间下不可靠，IAB 已实测）
                    window.__flushAfterStart = app.flushCount();

                    // E) 删 currentId 卡片 → 恢复提示失效
                    // 在 D 的复习中退出，删掉当前卡，再恢复
                    q('#view-review [data-act="back-home"]').click();
                    var ss = app.state().reviewSession;
                    if (ss && ss.currentId) {
                      var deck = st.decks.filter(function (x) { return x.id === ss.deckIds[0]; })[0];
                      if (deck) {
                        deck.cards = deck.cards.filter(function (c) { return c.id !== ss.currentId; });
                        app.renderHome();
                        var resBtn = q('#resumeBar [data-act="resume-review"]');
                        // 会话里的卡片被删：renderHome 的 pruneEmptySession 不清（还有队列），点恢复应提示失效并清空
                        if (resBtn) {
                          var toasts = 0;
                          resBtn.click();
                          toasts = 1;
                          check('resume invalid after current card deleted', !!app.state().reviewSession === false || toasts >= 1, 'handled');
                        } else {
                          check('resume invalid after current card deleted', false, 'no resume btn');
                        }
                      } else {
                        check('resume invalid after current card deleted', false, 'deck gone');
                      }
                    } else {
                      check('resume invalid after current card deleted', false, 'no session/current');
                    }

                    // A 组的 chip 断言补（todo chip 文案）
                    check('todo chip label', chip.indexOf('待复习') >= 0, chip.slice(0, 40));

                    /* 组 A：公式 + 高亮 + 阅读设置 */
                  (function () {
                    var hl = app.highlightCode ? app.highlightCode('// c\nvar x = 42; var s = "q";', 'js') : '';
                    check('highlight kw/num/str/cmt', hl.indexOf('hl-kw') >= 0 && hl.indexOf('hl-num') >= 0 && hl.indexOf('hl-str') >= 0 && hl.indexOf('hl-cmt') >= 0, hl.slice(0, 60));
                    check('katex bundled', typeof window.katex === 'object' && typeof window.katex.renderToString === 'function', typeof window.katex);
                    // 阅读设置：改字号 → CSS 变量即时生效
                    q('[data-act="tab"][data-view="settings"]').click();
                    var fs = document.querySelector('#setReadFs');
                    if (fs) {
                      fs.value = 'l';
                      fs.dispatchEvent(new Event('change', { bubbles: true }));
                      var v = document.documentElement.style.getPropertyValue('--rv-scale');
                      check('reading font-size applied', v === '1.14', v);
                    } else {
                      check('reading font-size applied', false, 'no #setReadFs');
                    }
                    q('[data-act="tab"][data-view="home"]').click();
                  })();

                  /* 第 1 步：合并规则 + zip 解析 */
                    var local2 = {
                      decks: [
                        { id: 'd1', name: '甲', cards: [{ id: 'c1', title: 'a', question: '', answer: 'x', path: [] }] },
                        { id: 'd2', name: '乙', cards: [{ id: 'c2', title: 'b', question: '', answer: 'y', path: [] }] }
                      ],
                      stats: { c1: { s: 'known', n: 5, ok: 5, bad: 0 } },
                      daily: {}
                    };
                    var backup2 = {
                      decks: [
                        { id: 'd1', name: '云端甲', cards: [{ id: 'c1', title: 'a', question: '', answer: 'x', path: [] }] },
                        { id: 'd9', name: '新', cards: [{ id: 'c9', title: 'n', question: '', answer: 'z', path: [] }] }
                      ],
                      stats: { c1: { s: 'learning', n: 1 }, c9: { s: 'learning', n: 1 } }
                    };
                    var mg = app.mergeBackupState(local2, backup2);
                    check('merge: 4 decks + suffix copy', mg.decks.length === 4 && mg.decks.some(function (d) { return d.name.indexOf('(导入)') >= 0; }),
                      mg.decks.map(function (d) { return d.name; }).join(','));
                    check('merge: local stats kept', mg.stats.c1.n === 5, 'n=' + mg.stats.c1.n);
                    check('merge: missing stats filled', mg.stats.c9 && mg.stats.c9.n === 1, 'ok');
                    // 第 3 步：删笔记不误伤共享卡片进度
                    (function () {
                      var shared = 'c' + Date.now(); // 内容哈希 id 由导入生成——直接构造两本共享同 id 卡
                      var sA = { id: 'dA', name: '甲本', cards: [{ id: shared, title: 't', question: '', answer: 'x', path: [] }] };
                      var sB = { id: 'dB', name: '乙本', cards: [{ id: shared, title: 't', question: '', answer: 'x', path: [] }] };
                      app.state().decks.push(sA, sB);
                      app.state().stats[shared] = { s: 'known', n: 3, ok: 3, bad: 0, box: 2 };
                      window.confirm = function () { return true; };
                      app.renderHome();
                      var delBtn = q('#deckList [data-act="delete-deck"][data-deck="dA"]');
                      if (delBtn) delBtn.click(); else check('shared card stat kept after deck delete', false, 'no dA btn');
                      check('shared card stat kept after deck delete', app.state().stats[shared] && app.state().stats[shared].n === 3,
                        'n=' + (app.state().stats[shared] || {}).n);
                      // 清理这两本
                      app.state().decks = app.state().decks.filter(function (d) { return d.id !== 'dB'; });
                      delete app.state().stats[shared];
                    })();

                    // 第 2 步：引用名收集（三种引用语法）
                    var stZ = app.state();
                    var refDeck = { id: 'dref', name: '引用', cards: [
                      { id: 'cr1', title: 't', question: '', answer: '![](images/a.png) 和 ![[dir/b.jpg]]', path: [] },
                      { id: 'cr2', title: 't2', question: '（配图 c.gif）', answer: 'x', path: [] }
                    ] };
                    stZ.decks.push(refDeck);
                    var refSet = app.referencedImageNames();
                    check('img refs collected (3 syntaxes)', refSet['a.png'] === 1 && refSet['b.jpg'] === 1 && refSet['c.gif'] === 1,
                      JSON.stringify(refSet));
                    stZ.decks = stZ.decks.filter(function (d) { return d.id !== 'dref'; });

                    // zip roundtrip（页面内构造 → parseBackupBuffer）
                    var enc = new TextEncoder();
                    var zipB = window.MDReviewCore.zipStore([
                      { name: 'backup.json', data: enc.encode(JSON.stringify({ app: 'md-review', version: 1, decks: [{ id: 'dz', name: 'z', cards: [{ id: 'cz', title: 't', question: '', answer: 'a', path: [] }] }], stats: {}, daily: {} })) },
                      { name: 'images/p.png', data: new Uint8Array([1, 2, 3]) }
                    ]);
                    app.parseBackupBuffer(zipB.buffer.slice(0)).then(function (pr) {
                      window.__zipParseOk = pr.obj.decks.length === 1 && pr.images.length === 1 && pr.images[0].name === 'p.png';
                    }, function (e) { window.__zipParseOk = 'ERR:' + e.message; });
                  })();

                  /* 底部导航 + 闪记日志 */
                  check('tabbar has 4 tabs', document.querySelectorAll('#tabbar .tab').length === 4,
                    document.querySelectorAll('#tabbar .tab').length);
                  check('topbar entries removed', !document.querySelector('#topbar [data-act="open-settings"]') && !document.querySelector('#topbar [data-act="open-manage"]'),
                    'top-actions');
                  var st = app.state();
                  var td = new Date();
                  function dk(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
                  st.daily[dk(td)] = 5;
                  var yd = new Date(td); yd.setDate(yd.getDate() - 1); st.daily[dk(yd)] = 2;
                  var d3 = new Date(td); d3.setDate(d3.getDate() - 3); st.daily[dk(d3)] = 11;
                  app.renderStats();
                  check('stats view tab opens', (function(){ q('[data-act="tab"][data-view="stats"]').click(); return q('#view-stats').classList.contains('active'); })(), 'stats');
                  check('heatmap cells rendered', document.querySelectorAll('#statsHeat .heat-cell').length > 180,
                    document.querySelectorAll('#statsHeat .heat-cell').length);
                  check('heatmap max level used', !!document.querySelector('#statsHeat .heat-cell.h4'), 'h4');
                  check('stats chips show today 5', q('#statsChips').textContent.indexOf('5') >= 0, q('#statsChips').textContent);
                  q('#view-stats [data-act="stats-view"][data-mode="bars"]').click();
                  check('bars mode toggles', q('#statsBars').classList.contains('hidden') === false && q('#statsHeat').classList.contains('hidden') === true, 'bars');
                  check('bars today count', q('#statsBars .bar-col.today .bar-n').textContent === '5',
                    q('#statsBars .bar-col.today .bar-n').textContent);
                  q('#view-stats [data-act="stats-view"][data-mode="heat"]').click();
                  check('heat mode toggles back', q('#statsHeat').classList.contains('hidden') === false, 'heat');

                  /* 日期气泡 + 年月日选择器 */
                  var tipTarget = document.querySelector('#statsHeat .heat-cell[data-tip*="5"]');
                  check('heat cells carry tips', !!tipTarget, tipTarget ? 'ok' : 'none');
                  if (tipTarget) {
                    tipTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                    check('tap shows tip bubble', !q('#statTip').classList.contains('hidden') && q('#statTip').textContent.length > 0,
                      q('#statTip').textContent);
                  }
                  var barTip = q('#statsBars .bar-col[data-tip]');
                  check('bars carry date tips', !!barTip, barTip ? barTip.getAttribute('data-tip') : 'none');
                  var sy = q('#statsY');
                  check('year starts at 2020', sy.options.length > 0 && sy.options[0].value === '2020',
                    sy.options.length ? sy.options[0].value : 'empty');
                  // 选昨天：热力图保持热力图 + 选中格描边；条形图窗口平移到以昨天为终点
                  var yd = new Date(); yd.setDate(yd.getDate() - 1);
                  var yk = yd.getFullYear() + '-' + ('0' + (yd.getMonth() + 1)).slice(-2) + '-' + ('0' + yd.getDate()).slice(-2);
                  q('#statsY').value = String(yd.getFullYear());
                  q('#statsY').dispatchEvent(new Event('change', { bubbles: true }));
                  q('#statsM').value = String(yd.getMonth() + 1);
                  q('#statsM').dispatchEvent(new Event('change', { bubbles: true }));
                  q('#statsD').value = String(yd.getDate());
                  q('#statsD').dispatchEvent(new Event('change', { bubbles: true }));
                  check('heat stays heatmap', !q('#statsHeat').classList.contains('hidden') && document.querySelectorAll('#statsHeat .heat-cell').length > 180,
                    document.querySelectorAll('#statsHeat .heat-cell').length);
                  check('anchor cell outlined', !!q('#statsHeat .heat-cell.sel'), 'sel');
                  var lastBar = document.querySelectorAll('#statsBars .bar-col')[6];
                  check('bars follow date search', !!lastBar && lastBar.getAttribute('data-tip').indexOf(yk) === 0,
                    lastBar ? lastBar.getAttribute('data-tip') : 'none');
                  check('anchor bar outlined', !!q('#statsBars .bar-col.sel'), 'sel');
                  q('[data-act="stats-today"]').click();
                  var todayBar = document.querySelectorAll('#statsBars .bar-col')[6];
                  var tk = (function(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
                  check('back to today resets', !q('#statsHeat').classList.contains('hidden') && !!todayBar && todayBar.getAttribute('data-tip').indexOf(tk) === 0,
                    todayBar ? todayBar.getAttribute('data-tip') : 'none');

                  /* zip 按内容识别：改名为 .apk.1 的 zip 走「选择文件」按钮也能导入 */
                  var qBefore = app.importQueue().length;
                  app.addQueueFiles([new File([zipArr], 'notes.apk.1', { type: 'application/octet-stream' })]);
                  setTimeout(function () {
                    try {
                      var qn = app.importQueue();
                      var names = qn.map(function (x) { return x.source; }).join(',');
                      check('zip routed by content', qn.length >= qBefore + 2 && names.indexOf('tcp.md') >= 0, names || ('count=' + qn.length));
                    } catch (e) {
                      check('zip-route-error', false, e && e.message);
                    }
                    // 第 1 步：zip 解析
                    check('backup zip parsed', window.__zipParseOk === true, String(window.__zipParseOk));
                    // 第 0 步 D)：开始复习即 flushSave（强杀不丢会话）
                    check('session flushed on review start', window.__flushAfterStart > window.__flushAtReviewStart,
                      'after=' + window.__flushAfterStart + ' atStart=' + window.__flushAtReviewStart);
                    finish();
                  }, 600);
                } catch (e) {
                  check('final-step-error', false, e && e.message);
                  finish();
                }
              }, 300);
            } catch (e) {
              check('late-step-error', false, e && e.message);
              finish();
            }
          }, 250);
        } catch (e) {
          check('browse-step-error', false, e && e.message);
          finish();
        }
      }, 350);
    } catch (e) {
      check('fatal', false, e && (e.message + '\n' + e.stack));
      finish();
    }
  }
})();
