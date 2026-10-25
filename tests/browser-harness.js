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

  var started = Date.now();
  (function waitBoot() {
    var app = window.MDReviewApp;
    if (app && app.state && app.state()) { run(); return; }
    if (Date.now() - started > 12000) {
      check('boot', false, 'timeout waiting MDReviewApp');
      finish();
      return;
    }
    setTimeout(waitBoot, 60);
  })();

  function run() {
    var app = window.MDReviewApp;
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

      /* --- 复习 --- */
      q('[data-act="review"][data-deck="' + testDeckId + '"]').click();
      check('review active', q('#view-review').classList.contains('active'));
      check('card title shown', q('#rvTitle').textContent.length > 0, q('#rvTitle').textContent);
      check('progress text', q('#rvProg').textContent.indexOf('/') > 0, q('#rvProg').textContent);
      check('answer hidden initially', q('#rvAnswer').classList.contains('hidden'));
      check('rate row hidden initially', q('#rateRow').classList.contains('hidden'));

      q('[data-act="show-answer"]').click();
      check('answer visible after reveal', !q('#rvAnswer').classList.contains('hidden'));
      check('answer html rendered', q('#rvAnswer').innerHTML.length > 5);
      check('rate row visible after reveal', !q('#rateRow').classList.contains('hidden'));

      q('[data-rate="ok"]').click();
      var stats = app.state().stats;
      var known = 0;
      Object.keys(stats).forEach(function (k) { if (stats[k].s === 'known') known++; });
      check('stat recorded', Object.keys(stats).length >= 1, Object.keys(stats).length);
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

              /* --- 导出弹层 --- */
              q('[data-act="export-all"]').click();
              check('export modal', !q('#modal').classList.contains('hidden'));
              check('export has json', q('#modalBox textarea') && q('#modalBox textarea').value.indexOf('md-review') >= 0);
              q('[data-act="close-modal"]').click();
              check('modal closed', q('#modal').classList.contains('hidden'));

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
              q('[data-act="open-settings"]').click();
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
