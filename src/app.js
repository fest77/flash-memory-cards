/*!
 * MD 笔记闪卡 · 界面逻辑
 * 依赖 core.js 暴露的 window.MDReviewCore
 */
(function () {
  'use strict';

  var Core = window.MDReviewCore;
  if (!Core) return;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var ESC = Core.escapeHtml;

  var GRAN = { fine: 800, mid: 1600, coarse: 3000 };
  var MODE_LABELS = {
    auto: '自动（推荐）',
    h2: '按二级标题 ##',
    h3: '按三级标题 ###',
    qa: '按问答 Q:/A:',
    hr: '按分隔线 ---',
    para: '按段落'
  };
  var QSTYLE_LABELS = {
    prompt: '提问式（推荐）',
    title: '标题式（不生成提问）',
    cloze: '挖空式（填空）'
  };
  var AI_DEFAULT = { base: '', model: '', key: '' };
  var AI_BATCH_CHARS = 5000;
  var AI_TIMEOUT = 60000;

  var SAMPLE_MD = [
    '# 示例 · 计算机网络 & 操作系统',
    '',
    '这是内置示例，用来演示「长笔记 → 卡片 → 随机复习」。导入你自己的 md 后会替换掉。',
    '',
    '## TCP 为什么需要三次握手？',
    '',
    '两次握手无法确认「客户端的接收能力」和「服务端的历史连接请求」：',
    '',
    '1. 防止已失效的连接请求突然又传到服务端，造成资源浪费；',
    '2. 只有三次握手才能让双方都确认对方的收发能力正常。',
    '',
    '## HTTP 和 HTTPS 的区别',
    '',
    '| 维度 | HTTP | HTTPS |',
    '| --- | --- | --- |',
    '| 加密 | 明文 | TLS 加密 |',
    '| 端口 | 80 | 443 |',
    '| 证书 | 无 | 需要 CA 证书 |',
    '',
    '## 进程和线程的区别',
    '',
    'Q: 进程和线程最核心的区别是什么？',
    'A: 进程是资源分配的基本单位，线程是 CPU 调度的基本单位；同一进程内的线程共享地址空间，切换开销更小。',
    '',
    'Q: 协程和线程的区别？',
    'A: 协程是用户态调度，切换不需要内核参与，开销远小于线程；但协程不能利用多核，需要配合多线程。',
    '',
    '## 死锁的四个必要条件',
    '',
    '- 互斥：资源同一时刻只能被一个进程占用',
    '- 占有并等待：持有资源的同时等待其他资源',
    '- 不可抢占：资源只能由持有者主动释放',
    '- 循环等待：存在进程与资源的环形等待链',
    '',
    '## 数据库索引为什么用 B+ 树',
    '',
    '```text',
    'B+ 树：非叶子节点只存索引，叶子节点存数据并用链表相连',
    '→ 层数低（3~4 层可存千万级），磁盘 IO 次数少；范围查询友好。',
    '```',
    '',
    '对比哈希索引：哈希只适合等值查询，不支持范围查询和排序。',
    '',
    '## 什么是虚拟内存',
    '',
    '虚拟内存给每个进程一个独立的、连续的地址空间，由 MMU + 页表映射到物理内存；',
    '好处是隔离、按需调页、可以运行比物理内存更大的程序，代价是缺页中断。'
  ].join('\n');

  /* ============================== 存储 ============================== */

  var Store = (function () {
    var LS_KEY = 'mdreview.state.v1';
    var db = null;
    var dbTried = false;

    function openDB() {
      return new Promise(function (resolve) {
        if (dbTried) return resolve(db);
        dbTried = true;
        if (typeof indexedDB === 'undefined') return resolve(null);
        var settled = false;
        var finish = function (v) { if (!settled) { settled = true; db = v; resolve(v); } };
        var req;
        try {
          req = indexedDB.open('md-review', 1);
        } catch (e) {
          return finish(null);
        }
        req.onupgradeneeded = function () {
          try { req.result.createObjectStore('kv'); } catch (e) { /* ignore */ }
        };
        req.onsuccess = function () { finish(req.result); };
        req.onerror = function () { finish(null); };
        req.onblocked = function () { finish(null); };
        setTimeout(function () { finish(null); }, 1200);
      });
    }

    function idbGet(key) {
      return new Promise(function (resolve) {
        if (!db) return resolve(null);
        try {
          var tx = db.transaction('kv', 'readonly');
          var r = tx.objectStore('kv').get(key);
          r.onsuccess = function () { resolve(r.result == null ? null : r.result); };
          r.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }

    function idbPut(key, val) {
      return new Promise(function (resolve) {
        if (!db) return resolve(false);
        try {
          var tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(val, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }

    function lsGet() {
      try { return window.localStorage.getItem(LS_KEY); } catch (e) { return null; }
    }
    function lsSet(v) {
      try { window.localStorage.setItem(LS_KEY, v); return true; } catch (e) { return false; }
    }

    return {
      load: function () {
        return openDB().then(function () {
          return idbGet('state').then(function (v) {
            if (v != null) return v;
            return lsGet();
          });
        }).catch(function () { return lsGet(); });
      },
      save: function (json) {
        return openDB().then(function () {
          if (db) {
            return idbPut('state', json).then(function (ok) {
              if (!ok) lsSet(json);
              return ok;
            });
          }
          return lsSet(json);
        }).catch(function () { return lsSet(json); });
      }
    };
  })();

  /* ============================== 状态 ============================== */

  var state = null;
  var saveTimer = null;
  var toastTimer = null;
  var review = null;
  var browse = { deckId: null, q: '' };
  var quick = { deckId: null, q: '', chapter: '', collapsed: {}, tocOpen: false, highlight: '' };
  var modalPayload = null;
  var viewStack = 0;

  function uid(prefix) {
    return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function emptyState() {
    return {
      version: 1,
      decks: [],
      stats: {},
      daily: {},
      settings: {
        mode: 'auto',
        gran: 'mid',
        qstyle: 'prompt',
        filter: 'all',
        bundledVersion: '',
        ai: { base: '', model: '', key: '' }
      }
    };
  }

  function normalizeState(raw) {
    var s = emptyState();
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw.decks)) {
      raw.decks.forEach(function (d) {
        if (!d || !Array.isArray(d.cards)) return;
        var cards = d.cards.filter(function (c) {
          return c && c.id && typeof c.answer === 'string' && c.answer.length > 0;
        }).map(function (c) {
          return {
            id: String(c.id),
            title: c.title || '',
            question: c.question || '',
            answer: c.answer,
            path: Array.isArray(c.path) ? c.path : []
          };
        });
        if (!cards.length) return;
        s.decks.push({
          id: d.id || uid('d'),
          name: d.name || '未命名笔记',
          title: d.title || '',
          createdAt: d.createdAt || Date.now(),
          mode: d.mode || 'auto',
          qstyle: d.qstyle || 'prompt',
          raw: typeof d.raw === 'string' ? d.raw : '',
          source: typeof d.source === 'string' ? d.source : '',
          bundled: !!d.bundled,
          cards: cards
        });
      });
    }
    if (raw.stats && typeof raw.stats === 'object') s.stats = raw.stats;
    if (raw.daily && typeof raw.daily === 'object') s.daily = raw.daily;
    if (raw.settings && typeof raw.settings === 'object') {
      Object.keys(s.settings).forEach(function (k) {
        if (raw.settings[k] != null) s.settings[k] = raw.settings[k];
      });
    }
    if (!GRAN[s.settings.gran]) s.settings.gran = 'mid';
    if (!MODE_LABELS[s.settings.mode]) s.settings.mode = 'auto';
    if (!QSTYLE_LABELS[s.settings.qstyle]) s.settings.qstyle = 'prompt';
    if (s.settings.filter !== 'todo') s.settings.filter = 'all';
    var ai = s.settings.ai;
    if (!ai || typeof ai !== 'object') s.settings.ai = { base: '', model: '', key: '' };
    else {
      s.settings.ai = {
        base: typeof ai.base === 'string' ? ai.base : '',
        model: typeof ai.model === 'string' ? ai.model : '',
        key: typeof ai.key === 'string' ? ai.key : ''
      };
    }
    return s;
  }

  function pruneDaily() {
    var keys = Object.keys(state.daily);
    if (keys.length < 200) return;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 120);
    var min = cutoff.getFullYear() + '-' + pad2(cutoff.getMonth() + 1) + '-' + pad2(cutoff.getDate());
    keys.forEach(function (k) {
      if (k < min) delete state.daily[k];
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      var json = JSON.stringify(state);
      Store.save(json).catch(function () {});
    }, 250);
  }

  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { Store.save(JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ============================== 派生数据 ============================== */

  function findDeck(id) {
    for (var i = 0; i < state.decks.length; i++) if (state.decks[i].id === id) return state.decks[i];
    return null;
  }

  function statusOf(cardId) {
    var st = state.stats[cardId];
    return st && st.s ? st.s : 'new';
  }

  function ensureStat(cardId) {
    if (!state.stats[cardId]) state.stats[cardId] = { s: 'new', n: 0, ok: 0, bad: 0, last: 0 };
    return state.stats[cardId];
  }

  function knownOf(deck) {
    var n = 0;
    deck.cards.forEach(function (c) { if (statusOf(c.id) === 'known') n++; });
    return n;
  }

  function bumpDaily() {
    var k = todayKey();
    state.daily[k] = (state.daily[k] || 0) + 1;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ============================== 通用 UI ============================== */

  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }

  function openModal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modalBox').innerHTML = '';
    modalPayload = null;
    document.body.style.overflow = '';
  }

  function showView(name, noPush) {
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    var v = $('#view-' + name);
    if (v) v.classList.add('active');
    if (name !== 'home' && !noPush) {
      try { window.history.pushState({ view: name }, ''); viewStack++; } catch (e) { /* file:// 等环境忽略 */ }
    }
    window.scrollTo(0, 0);
  }

  function goHome() {
    if (review) review = null;
    renderHome();
    showView('home', true);
  }

  function goBack() {
    if (viewStack > 0) {
      try { window.history.back(); return; } catch (e) { /* fallthrough */ }
    }
    goHome();
  }

  function readFileText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || '')); };
      fr.onerror = function () { reject(fr.error || new Error('read error')); };
      fr.readAsText(file);
    });
  }

  /* ---------- 内置题库图片（（配图 xxx）→ 内嵌图） ---------- */

  var IMG_PLACEHOLDER = /（配图\s*([^）]+?)）/g;

  function deckImageSet(deck) {
    var all = window.MDReviewBundledImages;
    if (!all || !deck || !deck.name) return null;
    return all[deck.name] || null;
  }

  function renderAnswerHtml(markdown, deck) {
    var html = Core.renderMarkdown(markdown);
    var set = deckImageSet(deck);
    if (set) {
      html = html.replace(IMG_PLACEHOLDER, function (m, name) {
        var key = String(name).trim();
        var src = set[key];
        if (!src) return m;
        return '<img class="md-img" src="' + src + '" alt="' + ESC(key) + '" loading="lazy" decoding="async">';
      });
    }
    return html;
  }

  /* ============================== 首页 ============================== */

  function renderHome() {
    var totalCards = 0;
    var knownCards = 0;
    state.decks.forEach(function (d) {
      totalCards += d.cards.length;
      knownCards += knownOf(d);
    });
    var today = state.daily[todayKey()] || 0;
    var filter = state.settings.filter;

    $('#statBar').innerHTML =
      '<button class="chip ' + (filter === 'all' ? 'on' : '') + '" data-act="set-filter" data-filter="all">全部卡片 <b>' + totalCards + '</b></button>' +
      '<button class="chip ' + (filter === 'todo' ? 'on' : '') + '" data-act="set-filter" data-filter="todo">只看没掌握 <b>' + (totalCards - knownCards) + '</b></button>' +
      '<span class="chip">今日已复习 <b>' + today + '</b></span>';

    var hasDecks = state.decks.length > 0;
    $('#heroEmpty').classList.toggle('hidden', hasDecks);
    $('#homeBody').classList.toggle('hidden', !hasDecks);

    if (!hasDecks) {
      $('#deckList').innerHTML = '';
      return;
    }

    var html = state.decks.map(function (d) {
      var n = d.cards.length;
      var k = knownOf(d);
      var pct = n ? Math.round((k / n) * 100) : 0;
      return '' +
        '<div class="deck">' +
          '<div class="deck-top">' +
            '<div style="flex:1;min-width:0">' +
              '<div class="deck-name">' + ESC(d.name) + '</div>' +
              '<div class="deck-meta">' +
                n + ' 张卡片 · <span class="ok">已掌握 ' + k + '</span> · ' +
                '<span class="todo">待复习 ' + (n - k) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="deck-actions">' +
            '<button class="btn sm primary" data-act="review" data-deck="' + d.id + '">随机复习</button>' +
            '<button class="btn sm" data-act="quick" data-deck="' + d.id + '">分类速记</button>' +
            '<button class="btn sm" data-act="browse" data-deck="' + d.id + '">浏览/编辑</button>' +
            '<button class="btn sm" data-act="ai-deck" data-deck="' + d.id + '">AI 提炼</button>' +
            '<button class="btn sm" data-act="export-deck" data-deck="' + d.id + '">导出</button>' +
            '<button class="btn sm danger" data-act="delete-deck" data-deck="' + d.id + '">删除</button>' +
          '</div>' +
        '</div>';
    }).join('');

    if (state.decks.length > 1) {
      html = '<button class="btn primary big" data-act="review-all" style="margin-bottom:12px">🎲 全部笔记混合随机复习</button>' + html;
    }
    $('#deckList').innerHTML = html;

    $('#setMode').value = state.settings.mode || 'auto';
    $('#setGran').value = state.settings.gran || 'mid';
    if ($('#setQstyle')) $('#setQstyle').value = state.settings.qstyle || 'prompt';
    if ($('#aiBase')) {
      var ai = state.settings.ai || AI_DEFAULT;
      $('#aiBase').value = ai.base || '';
      $('#aiModel').value = ai.model || '';
      $('#aiKey').value = ai.key || '';
    }
  }

  /* ============================== 导入 ============================== */

  function currentOpts(override) {
    var o = override || {};
    var mode = o.mode || state.settings.mode || 'auto';
    var gran = o.gran || state.settings.gran || 'mid';
    var qstyle = o.qstyle || state.settings.qstyle || 'prompt';
    return { mode: mode, gran: gran, qstyle: qstyle, maxCardLen: GRAN[gran] || 1600 };
  }

  function importText(name, text, override, behavior) {
    var b = behavior || {};
    if (!text || text.trim().length < 10) {
      if (!b.silent) toast('内容太短，没有导入');
      return false;
    }
    var opts = currentOpts(override);
    var deck = Core.buildDeck(name, text, { mode: opts.mode, maxCardLen: opts.maxCardLen, qstyle: opts.qstyle });
    deck.source = b.source || '';
    if (!deck.cards.length) {
      if (!b.silent) toast('没有解析出卡片，试试换个「拆分方式」');
      return false;
    }

    var existIdx = -1;
    for (var i = 0; i < state.decks.length; i++) {
      if (state.decks[i].name === deck.name) { existIdx = i; break; }
    }
    if (existIdx >= 0) {
      if (b.replace === 'no') return false;
      if (b.replace !== 'yes') {
        if (!window.confirm('已存在同名笔记「' + deck.name + '」，用新内容替换吗？（尽量保留已掌握进度）')) {
          if (!b.silent) toast('已取消');
          return false;
        }
      }
      state.decks[existIdx] = deck;
    } else {
      state.decks.push(deck);
    }
    state.settings.mode = opts.mode;
    state.settings.gran = opts.gran;
    state.settings.qstyle = opts.qstyle;
    pruneDaily();
    if (!b.silent) {
      scheduleSave();
      renderHome();
      toast('已导入「' + deck.name + '」 ' + deck.cards.length + ' 张卡片', 2600);
    }
    return true;
  }

  /* ---------- 批量导入（文件队列 / zip / 文件夹） ---------- */

  var importQueue = [];

  function openImportModal() {
    importQueue = [];
    openModal(
      '<h3>导入笔记</h3>' +
      '<div class="imp-actions">' +
        '<button class="btn primary big" data-act="imp-pick">📄 选择 .md 文件（可多选）</button>' +
        '<button class="btn big" data-act="imp-zip">🗜️ 选择 .zip（一个包放多篇 md）</button>' +
        '<button class="btn big ghost" data-act="imp-dir">📁 导入整个文件夹（电脑端）</button>' +
      '</div>' +
      '<div id="impList" class="imp-list"></div>' +
      '<p class="modal-note">手机端如果系统文件选择器只能单选：<b>分几次点「选择 .md 文件」</b>，把多篇笔记加进列表，最后点「导入全部」；或者把多个 md 压成一个 zip 再选。zip 只在浏览器本地解压，不上传。</p>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">取消</button>' +
        '<button class="btn primary" data-act="imp-do">导入全部</button>' +
      '</div>'
    );
    renderImportQueue();
  }

  function renderImportQueue() {
    var box = $('#impList');
    if (!box) return;
    if (!importQueue.length) {
      box.innerHTML = '<p class="imp-empty">还没有选择文件</p>';
    } else {
      box.innerHTML = importQueue.map(function (item, idx) {
        var size = item.size ? ' · ' + (item.size / 1024).toFixed(0) + 'KB' : '';
        return '<div class="imp-item"><span class="imp-name">' + ESC(item.name) + size + '</span>' +
          '<button class="imp-del" data-act="imp-remove" data-idx="' + idx + '" aria-label="移除">×</button></div>';
      }).join('');
    }
    var btn = document.querySelector('[data-act="imp-do"]');
    if (btn) btn.textContent = importQueue.length ? ('导入全部（' + importQueue.length + '）') : '导入全部';
  }

  function isTextNote(name) {
    return /\.(md|markdown|txt)$/i.test(String(name || ''));
  }

  function addQueueFiles(files) {
    var arr = Array.prototype.slice.call(files || []);
    var added = 0;
    arr.forEach(function (f) {
      if (!isTextNote(f.name)) return;
      importQueue.push({ name: String(f.name).replace(/\.[^.]+$/, ''), file: f, size: f.size, source: f.name });
      added++;
    });
    if (!added) {
      toast(arr.length ? '只支持 .md / .markdown / .txt 文件' : '没有选择文件');
      return;
    }
    renderImportQueue();
  }

  function readFileBuffer(file) {
    if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error('read error')); };
      fr.readAsArrayBuffer(file);
    });
  }

  function addQueueZip(file) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name || '')) { toast('请选择 .zip 文件'); return; }
    toast('正在解压…', 4000);
    readFileBuffer(file)
      .then(function (buf) { return Core.unzipTextFiles(buf); })
      .then(function (list) {
        if (!list.length) { toast('zip 里没有找到 .md / .txt 文件'); return; }
        list.forEach(function (en) {
          var base = en.name.split('/').pop();
          importQueue.push({ name: base.replace(/\.[^.]+$/, ''), text: en.text, size: en.text.length, source: en.name });
        });
        renderImportQueue();
        toast('已从 zip 中取出 ' + list.length + ' 篇笔记', 2600);
      })
      .catch(function (err) {
        toast('解压失败：' + ((err && err.message) || '未知错误'), 4200);
      });
  }

  function doImportQueue() {
    if (!importQueue.length) { toast('先选择要导入的文件'); return; }
    var opts = currentOpts();
    var names = importQueue.map(function (x) { return x.name; });
    var conflicts = names.filter(function (n) {
      return state.decks.some(function (d) { return d.name === n; });
    }).length;
    var replace = 'ask';
    if (conflicts) {
      replace = window.confirm('有 ' + conflicts + ' 个同名笔记，用新内容替换吗？（取消 = 跳过同名）') ? 'yes' : 'no';
    }
    var total = importQueue.length;
    var okCount = 0;
    var idx = 0;
    closeModal();
    toast('开始导入 ' + total + ' 个文件…', 3000);

    function next() {
      if (idx >= total) {
        scheduleSave();
        renderHome();
        toast('导入完成：' + okCount + ' / ' + total + ' 个笔记', 3000);
        return;
      }
      var item = importQueue[idx++];
      var p = item.text != null ? Promise.resolve(item.text) : readFileText(item.file);
      p.then(function (text) {
        if (importText(item.name, text, opts, { silent: true, replace: replace, source: item.source || '' })) okCount++;
      }).catch(function () {
        toast('读取失败：' + item.name);
      }).then(function () {
        setTimeout(next, 20);
      });
    }
    next();
  }

  function removeQueueItem(idx) {
    importQueue.splice(idx, 1);
    renderImportQueue();
  }

  function openPasteModal() {
    openModal(
      '<h3>粘贴 Markdown 文本</h3>' +
      '<div class="field"><label>笔记名称</label><input id="pasteName" type="text" value="我的笔记" maxlength="60"></div>' +
      '<div class="field"><label>拆分方式</label><select id="pasteMode">' + modeOptions(state.settings.mode) + '</select></div>' +
      '<div class="field"><label>提问风格</label><select id="pasteQstyle">' + qstyleOptions(state.settings.qstyle) + '</select></div>' +
      '<div class="field"><label>卡片粒度</label><select id="pasteGran">' + granOptions(state.settings.gran) + '</select></div>' +
      '<textarea id="pasteText" placeholder="把 md 内容粘贴到这里…" style="min-height:180px"></textarea>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">取消</button>' +
        '<button class="btn primary" data-act="do-paste">导入</button>' +
      '</div>' +
      '<p class="modal-note">提示：按标题拆分会自动识别 # / ## / ###；如果笔记里是「Q: … A: …」格式，选「按问答」更准。</p>'
    );
  }

  function qstyleOptions(selected) {
    return Object.keys(QSTYLE_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + QSTYLE_LABELS[k] + '</option>';
    }).join('');
  }

  function modeOptions(selected) {
    var html = '';
    Object.keys(MODE_LABELS).forEach(function (k) {
      html += '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + MODE_LABELS[k] + '</option>';
    });
    return html;
  }

  function granOptions(selected) {
    var labels = { fine: '细（≤800 字/张）', mid: '中（≤1600 字/张）', coarse: '粗（≤3000 字/张）' };
    return Object.keys(labels).map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + labels[k] + '</option>';
    }).join('');
  }

  function doPaste() {
    var name = $('#pasteName') ? $('#pasteName').value.trim() : '';
    var text = $('#pasteText') ? $('#pasteText').value : '';
    var mode = $('#pasteMode') ? $('#pasteMode').value : 'auto';
    var qstyle = $('#pasteQstyle') ? $('#pasteQstyle').value : state.settings.qstyle;
    var gran = $('#pasteGran') ? $('#pasteGran').value : 'mid';
    if (!text || !text.trim()) { toast('还没有粘贴内容'); return; }
    if (importText(name || '粘贴笔记', text, { mode: mode, gran: gran, qstyle: qstyle })) closeModal();
  }

  function loadDemo() {
    importText('示例 · 计算机网络与操作系统', SAMPLE_MD, { mode: 'auto', gran: 'mid', qstyle: 'prompt' });
  }

  /* ---------- AI 提炼（可选；无服务器，用户自己填 API） ---------- */

  function aiConfig() {
    return state.settings.ai || AI_DEFAULT;
  }

  function aiEndpoint() {
    var base = (aiConfig().base || '').trim().replace(/\/+$/, '');
    if (!base) return '';
    if (/\/chat\/completions$/i.test(base)) return base;
    return base + '/chat/completions';
  }

  function aiReady() {
    return !!(aiEndpoint() && aiConfig().model);
  }

  function aiErrorHelp(err) {
    var msg = String((err && err.message) || err || '未知错误');
    if (/CORS|跨域|网络|Failed to fetch/i.test(msg)) {
      return msg + '\n跨域说明：浏览器直连多数厂商 API 会被 CORS 拦。可以改用支持跨域的中转/网关、本机 Ollama（启动时设 OLLAMA_ORIGINS=*），或者用电脑上的 tools/ai_cards.py 生成卡片 JSON 再导入。';
    }
    return msg;
  }

  function aiChat(messages, maxTokens) {
    var cfg = aiConfig();
    var url = aiEndpoint();
    if (!url) return Promise.reject(new Error('还没填写 API 地址（例如 https://api.deepseek.com/v1）'));
    if (!cfg.model) return Promise.reject(new Error('还没填写模型名（例如 deepseek-chat）'));
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (controller) timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT);
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        max_tokens: maxTokens || 1500,
        messages: messages
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) { data = null; }
        if (!res.ok) {
          var msg = (data && data.error && (data.error.message || data.error)) || String(text).slice(0, 200);
          throw new Error('HTTP ' + res.status + '：' + msg);
        }
        if (!data) throw new Error('返回内容不是 JSON：' + String(text).slice(0, 120));
        var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) throw new Error('返回里没有 choices[0].message.content');
        return content;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error('请求超时（' + (AI_TIMEOUT / 1000) + 's）');
      if (err instanceof TypeError) throw new Error('网络/跨域(CORS)失败：浏览器直连这个 API 被拒绝');
      throw err;
    }).then(function (v) {
      if (timer) clearTimeout(timer);
      return v;
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }

  function saveAiForm() {
    if (!$('#aiBase')) return;
    state.settings.ai = {
      base: $('#aiBase').value.trim(),
      model: $('#aiModel').value.trim(),
      key: $('#aiKey').value.trim()
    };
    scheduleSave();
  }

  function testAi() {
    saveAiForm();
    if (!aiEndpoint()) { toast('先填写 API 地址，例如 https://api.deepseek.com/v1'); return; }
    openModal(
      '<h3>测试 AI 连接</h3>' +
      '<div class="ai-out" id="aiTestOut">请求中…（最长等 ' + (AI_TIMEOUT / 1000) + ' 秒）</div>' +
      '<div class="modal-actions"><button class="btn" data-act="close-modal">关闭</button></div>'
    );
    aiChat([{ role: 'user', content: '只回复两个字：可用' }], 32).then(function (text) {
      var out = $('#aiTestOut');
      if (out) out.innerHTML = '<b class="ok">连接成功</b><br>模型回复：' + ESC(String(text).slice(0, 120));
    }).catch(function (err) {
      var out = $('#aiTestOut');
      if (out) out.innerHTML = '<b class="todo">连接失败</b><br>' + ESC(aiErrorHelp(err)).replace(/\n/g, '<br>');
    });
  }

  var aiRun = { active: false, cancel: false };

  function openAiModal(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    openModal(
      '<h3>AI 提炼提问</h3>' +
      '<p class="modal-note">用大模型读懂每张卡的答案，把标题改写成更像面试题的问题（<b>只改题面，不动答案</b>）。请求从你的手机直接发出，不经过任何服务器。</p>' +
      (aiReady() ? '' : '<p class="modal-note warn">还没有配置 AI：先在首页展开「AI 提炼设置」填 API 地址、模型名和 key。</p>') +
      '<div class="ai-out" id="aiOut">' + ESC(d.name) + ' · 共 ' + d.cards.length + ' 张卡 · '
        + (aiReady() ? '已就绪' : '未配置') + '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">关闭</button>' +
        '<button class="btn primary" data-act="ai-start" data-deck="' + d.id + '"' + (aiReady() ? '' : ' disabled') + '>开始提炼</button>' +
      '</div>'
    );
    modalPayload = { deckId: d.id };
  }

  function parseAiQuestions(content) {
    var text = String(content || '');
    var arr = null;
    var m = /\[[\s\S]*\]/.exec(text);
    if (m) {
      try { arr = JSON.parse(m[0]); } catch (e) { arr = null; }
    }
    if (!Array.isArray(arr)) {
      var om = /\{[\s\S]*\}/.exec(text);
      if (om) {
        try {
          var obj = JSON.parse(om[0]);
          if (obj && Array.isArray(obj.questions)) arr = obj.questions;
        } catch (e2) { arr = null; }
      }
    }
    if (!Array.isArray(arr)) return [];
    return arr.map(function (item) {
      if (typeof item === 'string') return { q: item };
      if (!item || typeof item !== 'object') return null;
      return {
        idx: item.idx != null ? item.idx : (item.i != null ? item.i : item.index),
        q: item.q || item.question || item.问题 || ''
      };
    }).filter(function (x) { return x && x.q; });
  }

  function startAiRefine() {
    var deckId = modalPayload && modalPayload.deckId;
    var d = findDeck(deckId);
    if (!d) return;
    if (aiRun.active) { toast('正在提炼，请稍等'); return; }
    if (!aiReady()) { toast('先配置 AI 地址和模型'); return; }

    var cards = d.cards;
    var batches = [];
    var cur = [];
    var curLen = 0;
    cards.forEach(function (c, i) {
      var itemLen = (c.title + c.answer).length;
      if (cur.length && curLen + itemLen > AI_BATCH_CHARS) { batches.push(cur); cur = []; curLen = 0; }
      cur.push({ i: i, title: c.title, answer: c.answer.slice(0, 2500) });
      curLen += itemLen;
    });
    if (cur.length) batches.push(cur);

    aiRun = { active: true, cancel: false, done: 0, total: cards.length };
    var changed = 0;
    var errors = [];

    function progress() {
      var out = $('#aiOut');
      if (out) out.innerHTML = '提炼中… ' + aiRun.done + ' / ' + aiRun.total + ' 张（共 ' + batches.length + ' 批）';
    }

    function runBatch(b) {
      progress();
      var payload = b.map(function (item) { return { idx: item.i, title: item.title, answer: item.answer }; });
      var sys = '你是资深技术面试官，负责把技术笔记整理成自测问题。要求：' +
        '1) 每个条目给出一句自然、具体、可用来自测的问题；' +
        '2) 问题必须能从给定答案回答出来，不得编造答案里没有的内容；' +
        '3) 标题本身已经是好问题时可以沿用或轻微润色；' +
        '4) 只输出 JSON，不要任何解释，格式：{"questions":[{"idx":数字,"q":"问题"}]}';
      return aiChat([
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(payload) }
      ], 2000).then(function (content) {
        var list = parseAiQuestions(content);
        if (!list.length) throw new Error('返回格式无法解析（需要 {"questions":[{"idx":..,"q":".."}]}）');
        var noIdx = list.every(function (x) { return x.idx == null; });
        list.forEach(function (item, k) {
          var targetIdx = noIdx ? (b[k] ? b[k].i : null) : Number(item.idx);
          if (targetIdx == null || !cards[targetIdx]) return;
          var q = String(item.q || '').trim();
          if (!q) return;
          cards[targetIdx].question = q;
          changed++;
        });
        aiRun.done += b.length;
      }).catch(function (err) {
        errors.push(aiErrorHelp(err));
        aiRun.done += b.length;
      });
    }

    function nextBatch(k) {
      if (aiRun.cancel || k >= batches.length) { finish(); return; }
      runBatch(batches[k]).then(function () {
        setTimeout(function () { nextBatch(k + 1); }, 60);
      });
    }

    function finish() {
      aiRun.active = false;
      scheduleSave();
      renderHome();
      var out = $('#aiOut');
      var msg = '完成：改写 ' + changed + ' 张卡' + (errors.length ? ('，' + errors.length + ' 批失败') : '');
      if (out) {
        out.innerHTML = '<b class="ok">' + msg + '</b>' +
          (errors.length ? '<br><span class="warn">' + ESC(errors[0]).replace(/\n/g, '<br>') + '</span>' : '');
      }
      toast(msg, 3000);
    }

    nextBatch(0);
  }

  function importCardsJson(text) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (!obj) { toast('不是有效的 JSON 文件'); return; }
    var decks = [];
    if (Array.isArray(obj)) decks = obj;
    else if (Array.isArray(obj.decks)) decks = obj.decks;
    else if (Array.isArray(obj.cards)) decks = [{ name: obj.name || 'AI 卡片', cards: obj.cards }];
    if (!decks.length) { toast('文件里没有 decks / cards'); return; }
    var added = 0;
    decks.forEach(function (srcDeck) {
      if (!srcDeck || !Array.isArray(srcDeck.cards) || !srcDeck.cards.length) return;
      var used = Object.create(null);
      var cards = [];
      srcDeck.cards.forEach(function (c) {
        if (!c) return;
        var title = String(c.title || c.q || c.question || '未命名').trim();
        var question = String(c.question || c.q || '').trim();
        var answer = String(c.answer || c.a || '');
        if (!answer.trim()) return;
        var id = 'c' + Core.hash32(title + '|' + question + '|' + answer);
        if (used[id]) { used[id]++; id = id + '-' + used[id]; } else { used[id] = 1; }
        cards.push({
          id: id, title: title, question: question, answer: answer,
          path: Array.isArray(c.path) ? c.path.filter(function (x) { return typeof x === 'string'; }) : []
        });
      });
      if (!cards.length) return;
      var name = String(srcDeck.name || srcDeck.title || 'AI 卡片').replace(/\.(md|markdown|txt|json)$/i, '').trim() || 'AI 卡片';
      var deck = {
        id: 'd' + Core.hash32(name + '|' + cards.length + '|' + Date.now()),
        name: name,
        title: srcDeck.title || name,
        createdAt: Date.now(),
        mode: 'ai',
        qstyle: 'prompt',
        raw: '',
        source: srcDeck.source || 'AI 卡片',
        cards: cards
      };
      var existIdx = -1;
      for (var i = 0; i < state.decks.length; i++) if (state.decks[i].name === name) { existIdx = i; break; }
      if (existIdx >= 0) state.decks[existIdx] = deck; else state.decks.push(deck);
      added += cards.length;
    });
    if (!added) { toast('没有可导入的卡片'); return; }
    scheduleSave();
    renderHome();
    toast('已导入 AI 卡片 ' + added + ' 张', 2800);
  }

  /* ============================== 复习 ============================== */

  function collectReviewItems(deckIds, filter) {
    var out = [];
    deckIds.forEach(function (id) {
      var d = findDeck(id);
      if (!d) return;
      d.cards.forEach(function (c) {
        if (filter === 'todo' && statusOf(c.id) === 'known') return;
        out.push({ card: c, deckId: id, deckName: d.name });
      });
    });
    return out;
  }

  function startReview(deckIds, filter) {
    var items = collectReviewItems(deckIds, filter || 'all');
    if (!items.length) {
      toast(filter === 'todo' ? '没有「没掌握」的卡片，先全部过一遍吧' : '没有可复习的卡片');
      return;
    }
    shuffle(items);
    review = {
      deckIds: deckIds.slice(),
      filter: filter || 'all',
      deckName: deckIds.length === 1
        ? (findDeck(deckIds[0]) || {}).name || '笔记'
        : '全部笔记 · ' + deckIds.length + ' 个文件',
      phase: 1,
      queue: items.slice(),
      round2: [],
      total: items.length,
      rated: 0,
      okCount: 0,
      fuzzyCount: 0,
      badCount: 0,
      current: null,
      revealed: false
    };
    $('#rvSummary').classList.add('hidden');
    $('#rvCard').classList.remove('hidden');
    $('#rvAnswer').innerHTML = '';
    showView('review');
    nextCard();
  }

  function currentRoundTotal() {
    return review ? review.total : 0;
  }

  function nextCard() {
    if (!review) return;
    if (!review.queue.length) {
      if (review.round2.length) {
        review.phase = 2;
        review.queue = shuffle(review.round2);
        review.round2 = [];
        review.total = review.queue.length;
        review.rated = 0;
        toast('进入第 2 轮：再过一遍模糊/忘记的 ' + review.total + ' 张', 2400);
      } else {
        finishReview();
        return;
      }
    }
    review.current = review.queue.shift();
    review.revealed = false;
    renderCard();
  }

  function renderCard() {
    if (!review || !review.current) return;
    var card = review.current.card;
    var q = review.current;

    $('#rvDeck').textContent = review.deckName + (review.phase > 1 ? ' · 第 2 轮' : '');
    var left = review.total - review.rated;
    $('#rvProg').textContent = '本轮 ' + review.rated + ' / ' + review.total + ' · 还剩 ' + left + ' 张';
    $('#rvBar').style.width = (currentRoundTotal() ? Math.min(100, (review.rated / currentRoundTotal()) * 100) : 0) + '%';

    var pathParts = [];
    if (review.deckIds.length > 1) pathParts.push(q.deckName);
    (card.path || []).forEach(function (p) { pathParts.push(p); });
    $('#rvPath').textContent = pathParts.join('  /  ');
    $('#rvTitle').textContent = card.title;

    var qText = (card.question || '').trim();
    var qEl = $('#rvQuestion');
    if (qText) {
      qEl.innerHTML = qText.indexOf('\n') >= 0 ? Core.renderMarkdown(qText) : Core.renderInline(qText);
      qEl.classList.remove('hidden');
    } else {
      qEl.innerHTML = '';
      qEl.classList.add('hidden');
    }

    $('#rvAnswer').innerHTML = '';
    $('#rvAnswer').classList.add('hidden');
    $('#rvCard').classList.remove('revealed', 'swipe-left', 'swipe-right');
    $('#btnShow').classList.remove('hidden');
    $('#rateRow').classList.add('hidden');
    $('#rvSummary').classList.add('hidden');
    $('#rvCard').classList.remove('hidden');
  }

  function showAnswer() {
    if (!review || !review.current || review.revealed) return;
    review.revealed = true;
    var card = review.current.card;
    var ans = $('#rvAnswer');
    ans.innerHTML = renderAnswerHtml(card.answer, findDeck(review.current.deckId));
    ans.classList.remove('hidden');
    $('#rvCard').classList.add('revealed');
    $('#btnShow').classList.add('hidden');
    $('#rateRow').classList.remove('hidden');
  }

  function rate(kind) {
    if (!review || !review.current || !review.revealed) return;
    var item = review.current;
    var st = ensureStat(item.card.id);
    st.n = (st.n || 0) + 1;
    st.last = Date.now();
    if (kind === 'ok') {
      st.ok = (st.ok || 0) + 1;
      st.s = 'known';
      review.okCount++;
    } else {
      st.bad = (st.bad || 0) + 1;
      st.s = 'learning';
      if (kind === 'fuzzy') review.fuzzyCount++;
      else review.badCount++;
      if (review.phase === 1) review.round2.push(item);
    }
    review.rated++;
    bumpDaily();
    scheduleSave();
    review.current = null;
    nextCard();
  }

  function finishReview() {
    $('#rvCard').classList.add('hidden');
    $('#btnShow').classList.add('hidden');
    $('#rateRow').classList.add('hidden');
    $('#rvBar').style.width = '100%';
    var s = $('#rvSummary');
    s.classList.remove('hidden');
    s.innerHTML =
      '<div class="big-emoji">🎉</div>' +
      '<h3>本轮完成</h3>' +
      '<p>' + ESC(review.deckName) + '</p>' +
      '<div class="sum-grid">' +
        '<div class="sum-item g"><b>' + review.okCount + '</b><span>记住了</span></div>' +
        '<div class="sum-item a"><b>' + review.fuzzyCount + '</b><span>模糊</span></div>' +
        '<div class="sum-item r"><b>' + review.badCount + '</b><span>忘了</span></div>' +
      '</div>' +
      '<div class="sum-actions">' +
        '<button class="btn primary big" data-act="again">🔁 再随机来一轮</button>' +
        '<button class="btn big" data-act="again-todo">只复习没掌握的</button>' +
        '<button class="btn big ghost" data-act="back-home">返回列表</button>' +
      '</div>';
    $('#rvProg').textContent = '本轮结束';
    review.current = null;
    review.revealed = false;
  }

  /* ============================== 浏览 / 编辑 ============================== */

  function openBrowse(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    browse.deckId = deckId;
    browse.q = '';
    $('#browseDeck').textContent = d.name;
    $('#browseMeta').textContent = d.cards.length + ' 张卡片 · 已掌握 ' + knownOf(d);
    $('#searchInput').value = '';
    renderBrowse();
    showView('browse');
  }

  function renderBrowse() {
    var d = findDeck(browse.deckId);
    if (!d) { goHome(); return; }
    var q = (browse.q || '').trim().toLowerCase();
    var list = d.cards.filter(function (c) {
      if (!q) return true;
      return (c.title + ' ' + (c.question || '') + ' ' + c.answer).toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) {
      $('#cardList').innerHTML = '<p class="muted" style="text-align:center;padding:34px 0">没有匹配的卡片</p>';
      return;
    }
    $('#cardList').innerHTML = list.map(function (c) {
      var s = statusOf(c.id);
      var label = s === 'known' ? '已掌握' : (s === 'learning' ? '待巩固' : '未复习');
      return '' +
        '<div class="citem" data-act="open-card" data-deck="' + d.id + '" data-card="' + ESC(c.id) + '">' +
          '<span class="dot ' + s + '" title="' + label + '"></span>' +
          '<div class="citem-main">' +
            '<div class="citem-title">' + ESC(c.title) + '</div>' +
            '<div class="citem-snip">' + ESC(Core.plainText(c.answer).slice(0, 80)) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function openCardModal() {
    var d = findDeck(browse.deckId);
    if (!d) return;
    var card = null;
    for (var i = 0; i < d.cards.length; i++) if (d.cards[i].id === browse.cardId) { card = d.cards[i]; break; }
    if (!card) return;
    openModal(
      '<h3>编辑卡片</h3>' +
      '<div class="md-view" style="max-height:32vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:10px 12px">' +
        renderAnswerHtml(card.answer, d) +
      '</div>' +
      '<div class="field"><label>标题</label><input id="editTitle" type="text" value="' + ESC(card.title) + '"></div>' +
      '<div class="field" style="display:block"><label style="display:block;margin-bottom:6px">题面（可留空）</label>' +
        '<textarea id="editQuestion" style="min-height:64px">' + ESC(card.question || '') + '</textarea></div>' +
      '<div class="field" style="display:block"><label style="display:block;margin-bottom:6px">答案（支持 Markdown）</label>' +
        '<textarea id="editAnswer" style="min-height:150px">' + ESC(card.answer) + '</textarea></div>' +
      '<div class="modal-actions">' +
        '<button class="btn danger" data-act="delete-card">删除</button>' +
        '<button class="btn" data-act="close-modal">关闭</button>' +
        '<button class="btn primary" data-act="save-card">保存</button>' +
      '</div>' +
      '<p class="modal-note">改动只保存在本机；导出备份可换手机。</p>'
    );
    modalPayload = { deckId: d.id, cardId: browse.cardId };
  }

  function saveCard() {
    if (!modalPayload) return;
    var d = findDeck(modalPayload.deckId);
    if (!d) return;
    var card = null;
    for (var i = 0; i < d.cards.length; i++) if (d.cards[i].id === modalPayload.cardId) { card = d.cards[i]; break; }
    if (!card) return;
    var title = $('#editTitle').value.trim();
    var question = $('#editQuestion').value.trim();
    var answer = $('#editAnswer').value;
    if (!answer.trim()) { toast('答案不能为空'); return; }
    card.title = title || Core.plainText(question || answer).slice(0, 40) || '未命名';
    card.question = question;
    card.answer = answer.replace(/\s+$/, '');
    scheduleSave();
    closeModal();
    renderBrowse();
    toast('已保存');
  }

  function deleteCard() {
    if (!modalPayload) return;
    var d = findDeck(modalPayload.deckId);
    if (!d) return;
    if (!window.confirm('删除这张卡片？')) return;
    d.cards = d.cards.filter(function (c) { return c.id !== modalPayload.cardId; });
    if (!d.cards.length) {
      state.decks = state.decks.filter(function (x) { return x.id !== d.id; });
    }
    scheduleSave();
    closeModal();
    goHome();
    toast('已删除');
  }

  /* ============================== 内置题库（随 html 一起打包） ============================== */

  function normalizeBundledCard(c) {
    var title = String(c.title || '').trim() || '未命名';
    var question = String(c.question || '').trim();
    var answer = String(c.answer || '');
    var path = Array.isArray(c.path) ? c.path.filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
    var id = 'c' + Core.hash32(title + '|' + question + '|' + answer);
    return { id: id, title: title, question: question, answer: answer, path: path };
  }

  function buildBundledDeck(bd) {
    var used = Object.create(null);
    var cards = [];
    (bd.cards || []).forEach(function (raw) {
      var c = normalizeBundledCard(raw);
      if (!c.answer.trim()) return;
      if (used[c.id]) { used[c.id]++; c.id = c.id + '-' + used[c.id]; } else { used[c.id] = 1; }
      cards.push(c);
    });
    var name = String(bd.name || '内置题库').trim();
    return {
      id: 'd' + Core.hash32('bundled|' + name),
      name: name,
      title: name,
      createdAt: Date.now(),
      mode: 'ai',
      qstyle: 'prompt',
      raw: '',
      source: String(bd.source || '内置题库'),
      bundled: true,
      cards: cards
    };
  }

  function seedBundledDecks(force) {
    var b = window.MDReviewBundledDecks;
    if (!b || !Array.isArray(b.decks) || !b.decks.length) return 0;
    if (!force && state.settings.bundledVersion === b.version) return 0;
    var added = 0;
    b.decks.forEach(function (bd) {
      var deck = buildBundledDeck(bd);
      if (!deck.cards.length) return;
      var idx = -1;
      for (var i = 0; i < state.decks.length; i++) {
        if (state.decks[i].name === deck.name) { idx = i; break; }
      }
      if (idx >= 0) state.decks[idx] = deck; else state.decks.push(deck);
      added += deck.cards.length;
    });
    state.settings.bundledVersion = b.version;
    return added;
  }

  function restoreBundled() {
    var added = seedBundledDecks(true);
    if (!added) { toast('没有内置题库可恢复'); return; }
    scheduleSave();
    renderHome();
    if ($('#view-manage').classList.contains('active')) renderManage();
    toast('已恢复内置题库：' + added + ' 张卡片', 2600);
  }

  /* ============================== 分类速记 ============================== */

  function chapterOf(card) {
    return (card.path && card.path[0]) ? card.path[0] : '未分类';
  }

  function quickChapterNames(deck) {
    var names = [];
    deck.cards.forEach(function (c) {
      var ch = chapterOf(c);
      if (names.indexOf(ch) < 0) names.push(ch);
    });
    return names;
  }

  function openQuick(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    quick = { deckId: deckId, q: '', chapter: '', collapsed: {}, tocOpen: false, highlight: '' };
    if ($('#quickSearch')) $('#quickSearch').value = '';
    showView('quick');
    renderQuick();
  }

  function renderQuick() {
    var d = findDeck(quick.deckId);
    if (!d) { goHome(); return; }
    var q = (quick.q || '').trim().toLowerCase();
    var all = d.cards.filter(function (c) {
      if (!q) return true;
      return (c.title + ' ' + (c.question || '') + ' ' + c.answer).toLowerCase().indexOf(q) >= 0;
    });
    $('#quickDeck').textContent = d.name;
    $('#quickMeta').textContent = d.cards.length + ' 张卡片 · ' + quickChapterNames(d).length + ' 个章节';

    var chapterNames = [];
    all.forEach(function (c) {
      var ch = chapterOf(c);
      if (chapterNames.indexOf(ch) < 0) chapterNames.push(ch);
    });
    $('#quickOutline').innerHTML =
      '<button class="chip ' + (!quick.chapter ? 'on' : '') + '" data-act="quick-chapter" data-ch="">全部 <b>' + all.length + '</b></button>' +
      chapterNames.map(function (ch) {
        return '<button class="chip ' + (quick.chapter === ch ? 'on' : '') + '" data-act="quick-chapter" data-ch="' + ESC(ch) + '">' + ESC(ch) + '</button>';
      }).join('');

    // 题目目录（两级：章 → 题），点题直接跳到对应卡片
    var tocEl = $('#quickToc');
    if (tocEl) {
      if (!quick.tocOpen) {
        tocEl.classList.add('hidden');
        tocEl.innerHTML = '';
      } else {
        tocEl.classList.remove('hidden');
        var tocCh = [];
        all.forEach(function (c) {
          var ch = chapterOf(c);
          var g = null;
          for (var i = 0; i < tocCh.length; i++) if (tocCh[i].ch === ch) { g = tocCh[i]; break; }
          if (!g) { g = { ch: ch, cards: [] }; tocCh.push(g); }
          g.cards.push(c);
        });
        tocEl.innerHTML = '<div class="toc-head">题目目录 · ' + all.length + ' 题（点一下跳转）</div>' +
          tocCh.map(function (g) {
            return '<div class="toc-ch">' + ESC(g.ch) + ' <span>' + g.cards.length + '</span></div>' +
              '<ol class="toc-list">' + g.cards.map(function (c, idx) {
                var label = (c.title || c.question || '未命名').replace(/\s+/g, ' ').slice(0, 70);
                return '<li><button class="toc-item" data-act="quick-jump" data-ch="' + ESC(g.ch) + '" data-card="' + ESC(c.id) + '">' +
                  '<span class="toc-num">' + (idx + 1) + '</span><span class="toc-text">' + ESC(label) + '</span></button></li>';
              }).join('') + '</ol>';
          }).join('');
      }
    }

    var groups = [];
    all.forEach(function (c) {
      var ch = chapterOf(c);
      if (quick.chapter && ch !== quick.chapter) return;
      if (!groups.length || groups[groups.length - 1].ch !== ch) {
        groups.push({ ch: ch, cards: [c] });
      } else {
        groups[groups.length - 1].cards.push(c);
      }
    });

    if (!groups.length) {
      $('#quickBody').innerHTML = '<p class="muted" style="text-align:center;padding:34px 0">没有匹配的内容</p>';
      return;
    }

    $('#quickBody').innerHTML = groups.map(function (g) {
      var collapsed = !!quick.collapsed[g.ch];
      return '<section class="quick-group' + (collapsed ? ' collapsed' : '') + '">' +
        '<button class="quick-ch" data-act="quick-fold" data-ch="' + ESC(g.ch) + '">' +
          '<span class="quick-ch-name">' + ESC(g.ch) + '</span>' +
          '<span class="quick-ch-count">' + g.cards.length + ' 题 · ' + (collapsed ? '展开' : '收起') + '</span>' +
        '</button>' +
        '<div class="quick-items">' + g.cards.map(function (c) {
          var qText = (c.question || '').trim();
          var head = qText ? (c.title ? c.title + '　' : '') + qText : c.title;
          return '<article class="quick-card" id="qc-' + ESC(c.id) + '">' +
            '<h3 class="quick-q">' + ESC(head) + '</h3>' +
            '<div class="quick-a">' + renderAnswerHtml(c.answer, d) + '</div>' +
          '</article>';
        }).join('') + '</div>' +
      '</section>';
    }).join('');

    if (quick.highlight) {
      var hid = quick.highlight;
      quick.highlight = '';
      var target = document.getElementById('qc-' + hid);
      if (target) {
        target.classList.add('flash');
        if (target.scrollIntoView) {
          try { target.scrollIntoView({ block: 'center' }); } catch (e) { target.scrollIntoView(); }
        }
        setTimeout(function () { target.classList.remove('flash'); }, 1800);
      }
    }
  }

  function toggleQuickToc() {
    quick.tocOpen = !quick.tocOpen;
    renderQuick();
  }

  function quickJump(ch, cardId) {
    quick.chapter = ch || '';
    quick.collapsed = {};
    quick.highlight = cardId || '';
    quick.tocOpen = false;
    renderQuick();
  }

  function toggleQuickAll() {
    var d = findDeck(quick.deckId);
    if (!d) return;
    var names = quickChapterNames(d);
    var anyOpen = names.some(function (ch) { return !quick.collapsed[ch]; });
    var next = {};
    names.forEach(function (ch) { if (anyOpen) next[ch] = true; });
    quick.collapsed = next;
    renderQuick();
  }

  /* ============================== 笔记管理 ============================== */

  function openManage() {
    showView('manage');
    renderManage();
  }

  function renderManage() {
    var totalCards = 0;
    state.decks.forEach(function (d) { totalCards += d.cards.length; });
    $('#manageMeta').textContent = state.decks.length + ' 个笔记 · ' + totalCards + ' 张卡片';
    if (!state.decks.length) {
      $('#manageList').innerHTML = '<p class="muted" style="text-align:center;padding:34px 0">还没有笔记，先导入 md 吧</p>';
      return;
    }
    $('#manageList').innerHTML = state.decks.map(function (d) {
      var n = d.cards.length;
      var k = knownOf(d);
      var src = d.source || (d.bundled ? '内置题库' : (d.mode === 'ai' ? 'AI 卡片' : '本地导入'));
      var when = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '';
      return '<div class="mdeck">' +
        '<div class="mdeck-top">' +
          '<div class="mdeck-name">' + ESC(d.name) + (d.bundled ? ' <span class="mdeck-tag">内置</span>' : '') + '</div>' +
          '<div class="mdeck-meta">' + n + ' 张 · 已掌握 ' + k + ' · ' + ESC(String(src)).slice(0, 40) + (when ? ' · ' + when : '') + '</div>' +
        '</div>' +
        '<div class="mdeck-actions">' +
          '<button class="btn sm primary" data-act="quick" data-deck="' + d.id + '">分类速记</button>' +
          '<button class="btn sm" data-act="review" data-deck="' + d.id + '">随机复习</button>' +
          '<button class="btn sm" data-act="manage-rename" data-deck="' + d.id + '">重命名</button>' +
          '<button class="btn sm" data-act="manage-reset" data-deck="' + d.id + '">重置进度</button>' +
          '<button class="btn sm" data-act="export-deck" data-deck="' + d.id + '">导出</button>' +
          '<button class="btn sm danger" data-act="delete-deck" data-deck="' + d.id + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openRenameModal(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    openModal(
      '<h3>重命名笔记</h3>' +
      '<div class="field" style="display:block"><input id="renameInput" type="text" value="' + ESC(d.name) + '" maxlength="60" style="max-width:100%"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">取消</button>' +
        '<button class="btn primary" data-act="do-rename" data-deck="' + d.id + '">保存</button>' +
      '</div>' +
      '<p class="modal-note">只改显示名称，卡片和复习进度不变。</p>'
    );
  }

  function doRename(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    var v = $('#renameInput') ? $('#renameInput').value.trim() : '';
    if (!v) { toast('名称不能为空'); return; }
    d.name = v;
    scheduleSave();
    closeModal();
    if ($('#view-manage').classList.contains('active')) renderManage(); else renderHome();
    toast('已重命名');
  }

  function resetDeckProgress(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    if (!window.confirm('把「' + d.name + '」的复习进度全部清零？')) return;
    d.cards.forEach(function (c) { delete state.stats[c.id]; });
    scheduleSave();
    if ($('#view-manage').classList.contains('active')) renderManage(); else renderHome();
    toast('进度已清零');
  }

  /* ============================== 备份 ============================== */

  function backupJson(deckIds) {
    var payload = {
      app: 'md-review',
      version: 1,
      exportedAt: new Date().toISOString(),
      decks: deckIds
        ? state.decks.filter(function (d) { return deckIds.indexOf(d.id) >= 0; })
        : state.decks,
      stats: state.stats,
      daily: state.daily,
      settings: state.settings
    };
    return JSON.stringify(payload, null, 2);
  }

  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  function showExport(json, filename) {
    var kb = (json.length / 1024).toFixed(1);
    openModal(
      '<h3>导出备份</h3>' +
      '<p class="modal-note">' + kb + ' KB · 含卡片与复习进度。下载后文件在手机「下载」目录；也可以复制文本自行保存。</p>' +
      '<textarea readonly style="min-height:150px;font-size:12.5px">' + ESC(json) + '</textarea>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">关闭</button>' +
        '<button class="btn" data-act="copy-json">复制文本</button>' +
        '<button class="btn primary" data-act="download-json">下载 .json</button>' +
      '</div>'
    );
    modalPayload = { json: json, filename: filename };
  }

  function downloadFile(filename, text) {
    // Android WebView 里没有浏览器下载通道，走原生桥直接写进「下载」目录
    if (window.AndroidSaver && typeof window.AndroidSaver.saveText === 'function') {
      try {
        var saved = window.AndroidSaver.saveText(filename, 'application/json', text);
        if (saved) {
          toast('已保存到手机「下载」目录：' + filename, 3000);
          return;
        }
      } catch (e) { /* fallback to browser download */ }
    }
    try {
      var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1500);
      toast('已开始下载（若没反应请用「复制文本」）', 2600);
    } catch (e) {
      toast('下载失败，请用「复制文本」');
    }
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? '已复制' : '复制失败，请手动全选复制');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }, fallback);
    } else {
      fallback();
    }
  }

  function importBackup(text) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (!obj || !Array.isArray(obj.decks)) {
      toast('文件不是有效的备份');
      return;
    }
    if (!window.confirm('导入备份会覆盖当前所有笔记和进度，确定继续？')) return;
    state = normalizeState(obj);
    pruneDaily();
    flushSave();
    renderHome();
    toast('备份已导入：' + state.decks.length + ' 个笔记', 2600);
  }

  /* ============================== 事件 ============================== */

  function onAction(act, el) {
    switch (act) {
      case 'open-import':
        openImportModal();
        break;
      case 'imp-pick':
        $('#fileInput').value = '';
        $('#fileInput').click();
        break;
      case 'imp-zip':
        $('#zipInput').value = '';
        $('#zipInput').click();
        break;
      case 'imp-dir':
        $('#dirInput').value = '';
        $('#dirInput').click();
        break;
      case 'imp-do':
        doImportQueue();
        break;
      case 'imp-remove':
        removeQueueItem(parseInt(el.getAttribute('data-idx'), 10));
        break;
      case 'ai-deck':
        openAiModal(el.getAttribute('data-deck'));
        break;
      case 'quick':
        openQuick(el.getAttribute('data-deck'));
        break;
      case 'open-manage':
        openManage();
        break;
      case 'quick-chapter':
        quick.chapter = el.getAttribute('data-ch') || '';
        renderQuick();
        break;
      case 'quick-fold': {
        var fch = el.getAttribute('data-ch') || '';
        if (quick.collapsed[fch]) delete quick.collapsed[fch];
        else quick.collapsed[fch] = true;
        renderQuick();
        break;
      }
      case 'quick-toggle-all':
        toggleQuickAll();
        break;
      case 'quick-toc':
        toggleQuickToc();
        break;
      case 'quick-jump':
        quickJump(el.getAttribute('data-ch') || '', el.getAttribute('data-card') || '');
        break;
      case 'manage-rename':
        openRenameModal(el.getAttribute('data-deck'));
        break;
      case 'do-rename':
        doRename(el.getAttribute('data-deck'));
        break;
      case 'manage-reset':
        resetDeckProgress(el.getAttribute('data-deck'));
        break;
      case 'restore-bundled':
        restoreBundled();
        break;
      case 'ai-start':
        startAiRefine();
        break;
      case 'ai-test':
        testAi();
        break;
      case 'import-cards-json':
        $('#cardsJsonInput').value = '';
        $('#cardsJsonInput').click();
        break;
      case 'paste':
        openPasteModal();
        break;
      case 'demo':
        loadDemo();
        break;
      case 'review': {
        var deckId = el.getAttribute('data-deck');
        startReview([deckId], state.settings.filter);
        break;
      }
      case 'review-all': {
        var ids = state.decks.map(function (d) { return d.id; });
        if (ids.length) startReview(ids, state.settings.filter);
        break;
      }
      case 'browse':
        openBrowse(el.getAttribute('data-deck'));
        break;
      case 'open-card': {
        browse.deckId = el.getAttribute('data-deck');
        browse.cardId = el.getAttribute('data-card');
        openCardModal();
        break;
      }
      case 'save-card':
        saveCard();
        break;
      case 'delete-card':
        deleteCard();
        break;
      case 'delete-deck': {
        var id = el.getAttribute('data-deck');
        var d = findDeck(id);
        if (!d) break;
        if (!window.confirm('删除笔记「' + d.name + '」及其 ' + d.cards.length + ' 张卡片？')) break;
        state.decks = state.decks.filter(function (x) { return x.id !== id; });
        scheduleSave();
        if ($('#view-manage').classList.contains('active')) { renderManage(); } else { renderHome(); }
        toast('已删除');
        break;
      }
      case 'export-deck': {
        var did = el.getAttribute('data-deck');
        var dd = findDeck(did);
        if (!dd) break;
        showExport(backupJson([did]), 'md-review-' + safeName(dd.name) + '-' + dateStamp() + '.json');
        break;
      }
      case 'export-all':
        if (!state.decks.length) { toast('还没有笔记'); break; }
        showExport(backupJson(null), 'md-review-backup-' + dateStamp() + '.json');
        break;
      case 'import-json':
        $('#jsonInput').value = '';
        $('#jsonInput').click();
        break;
      case 'download-json':
        if (modalPayload && modalPayload.json) downloadFile(modalPayload.filename || 'backup.json', modalPayload.json);
        break;
      case 'copy-json':
        if (modalPayload && modalPayload.json) copyText(modalPayload.json);
        break;
      case 'do-paste':
        doPaste();
        break;
      case 'set-filter':
        state.settings.filter = el.getAttribute('data-filter') === 'todo' ? 'todo' : 'all';
        scheduleSave();
        renderHome();
        break;
      case 'show-answer':
        showAnswer();
        break;
      case 'rate':
        rate(el.getAttribute('data-rate'));
        break;
      case 'reshuffle':
        if (review) {
          shuffle(review.queue);
          toast('已重新洗牌');
          renderCard();
        }
        break;
      case 'again':
        if (review) startReview(review.deckIds, review.filter);
        break;
      case 'again-todo':
        if (review) startReview(review.deckIds, 'todo');
        break;
      case 'reset-progress': {
        var rid = browse.deckId;
        var rd = findDeck(rid);
        if (!rd) break;
        if (!window.confirm('把「' + rd.name + '」的复习进度全部清零？')) break;
        rd.cards.forEach(function (c) { delete state.stats[c.id]; });
        scheduleSave();
        renderBrowse();
        toast('进度已清零');
        break;
      }
      case 'back-home':
        goBack();
        break;
      case 'close-modal':
        closeModal();
        break;
      default:
        break;
    }
  }

  function safeName(s) {
    return String(s || 'notes').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (el) {
        var act = el.getAttribute('data-act');
        if (act === 'show-answer' || act === 'rate') {
          // 由各自按钮处理，但统一走 onAction
        }
        onAction(act, el);
        return;
      }
      if (e.target.id === 'modal') closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (!$('#modal').classList.contains('hidden')) {
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (!$('#view-review').classList.contains('active') || !review) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!review.revealed) showAnswer();
        else rate('ok');
      } else if (e.key === '1') { rate('bad'); }
      else if (e.key === '2') { rate('fuzzy'); }
      else if (e.key === '3') { rate('ok'); }
      else if (e.key === 'Escape') { goBack(); }
    });

    $('#fileInput').addEventListener('change', function (e) {
      addQueueFiles(e.target.files);
      e.target.value = '';
    });

    $('#zipInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) addQueueZip(f);
      e.target.value = '';
    });

    $('#dirInput').addEventListener('change', function (e) {
      addQueueFiles(e.target.files);
      e.target.value = '';
    });

    $('#cardsJsonInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      readFileText(f).then(function (text) { importCardsJson(text); }).catch(function () { toast('读取失败'); });
      e.target.value = '';
    });

    $('#jsonInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      readFileText(f).then(function (text) { importBackup(text); }).catch(function () { toast('读取失败'); });
      e.target.value = '';
    });

    var searchTimer = null;
    $('#searchInput').addEventListener('input', function (e) {
      var v = e.target.value;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        browse.q = v;
        renderBrowse();
      }, 120);
    });

    var quickTimer = null;
    if ($('#quickSearch')) {
      $('#quickSearch').addEventListener('input', function (e) {
        var v = e.target.value;
        if (quickTimer) clearTimeout(quickTimer);
        quickTimer = setTimeout(function () {
          quick.q = v;
          renderQuick();
        }, 150);
      });
    }

    document.addEventListener('change', function (e) {
      if (e.target.id === 'setMode') {
        state.settings.mode = e.target.value;
        scheduleSave();
        toast('拆分方式已切换，下次导入生效');
      } else if (e.target.id === 'setGran') {
        state.settings.gran = e.target.value;
        scheduleSave();
        toast('卡片粒度已切换，下次导入生效');
      } else if (e.target.id === 'setQstyle') {
        state.settings.qstyle = e.target.value;
        scheduleSave();
        toast('提问风格已切换，下次导入生效');
      } else if (e.target.id === 'aiBase' || e.target.id === 'aiModel' || e.target.id === 'aiKey') {
        saveAiForm();
      }
    });

    // 复习卡片：点按显示答案 / 左右滑动评价
    var cardEl = $('#rvCard');
    var touch = null;
    var suppressTap = false;

    cardEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      if (suppressTap) { suppressTap = false; return; }
      if (review && !review.revealed) showAnswer();
    });

    cardEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      touch = { x: e.clientX, y: e.clientY, t: Date.now() };
    });

    cardEl.addEventListener('pointerup', function (e) {
      if (!touch) return;
      var dx = e.clientX - touch.x;
      var dy = e.clientY - touch.y;
      var dt = Date.now() - touch.t;
      touch = null;
      if (dt > 800) return;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (!review) return;
      if (!review.revealed) { showAnswer(); return; }
      suppressTap = true;
      var cls = dx > 0 ? 'swipe-right' : 'swipe-left';
      cardEl.classList.add(cls);
      setTimeout(function () {
        if (review) rate(dx > 0 ? 'ok' : 'bad');
      }, 140);
    });

    window.addEventListener('popstate', function () {
      if (viewStack > 0) {
        viewStack--;
        goHome();
      }
    });

    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushSave();
    });
  }

  /* ============================== 启动 ============================== */

  // 调试 / 自动化测试用的最小接口（不影响正常使用）
  window.MDReviewApp = {
    state: function () { return state; },
    importText: importText,
    importCardsJson: importCardsJson,
    startReview: startReview,
    showAnswer: showAnswer,
    rate: rate,
    renderHome: renderHome,
    openImportModal: openImportModal,
    addQueueFiles: addQueueFiles,
    importQueue: function () { return importQueue; },
    openQuick: openQuick,
    renderQuick: renderQuick,
    openManage: openManage,
    renderManage: renderManage,
    seedBundledDecks: seedBundledDecks,
    version: '1.5.0'
  };

  function boot() {
    Store.load().then(function (raw) {
      var saved = null;
      if (raw) {
        try { saved = JSON.parse(raw); } catch (e) { saved = null; }
      }
      state = normalizeState(saved);
      pruneDaily();
      var seeded = seedBundledDecks(false);
      bindEvents();
      renderHome();
      if (seeded) scheduleSave();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
