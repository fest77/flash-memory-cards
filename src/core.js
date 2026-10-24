/*!
 * MD 笔记闪卡 · 核心逻辑（解析 / 拆卡 / Markdown 渲染）
 * 纯函数，无 DOM 依赖，可在 Node 中直接测试。
 */
(function (global) {
  'use strict';

  var CORE_VERSION = '1.1.0';

  /* ============================== 工具 ============================== */

  function hash32(str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u0000/g, '');
  }

  function stripFrontMatter(text) {
    var m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
    if (m) return { body: text.slice(m[0].length), frontmatter: m[1] };
    return { body: text, frontmatter: '' };
  }

  function trimBlank(text) {
    return String(text).replace(/^\n+/, '').replace(/\s+$/, '');
  }

  function cleanInline(s) {
    return String(s == null ? '' : s)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ============================== 代码块掩码 ============================== */

  // 返回 mask[i] = true 表示第 i 行属于代码块（或围栏行），不应参与标题/问答识别
  function codeMask(lines) {
    var mask = new Array(lines.length);
    var fence = null;
    for (var i = 0; i < lines.length; i++) {
      mask[i] = false;
      var m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i]);
      if (!fence) {
        if (m) {
          fence = { ch: m[1].charAt(0), len: m[1].length };
          mask[i] = true;
        }
      } else {
        mask[i] = true;
        if (m && m[1].charAt(0) === fence.ch && m[1].length >= fence.len && !m[2].trim()) {
          fence = null;
        }
      }
    }
    return mask;
  }

  /* ============================== 标题 / 小节 ============================== */

  function collectHeadings(lines, mask) {
    var hs = [];
    for (var i = 0; i < lines.length; i++) {
      if (mask[i]) continue;
      var m = /^ {0,3}(#{1,6})[ \t]+(.*)$/.exec(lines[i]);
      if (!m) continue;
      var text = m[2].replace(/[ \t]+#+[ \t]*$/, '').trim();
      var title = cleanInline(text);
      if (!title) continue;
      hs.push({ index: i, level: m[1].length, title: title });
    }
    return hs;
  }

  // 在 [from, to) 行区间内，构造 level 级小节
  function sectionsAt(lines, headings, level, from, to) {
    from = from == null ? 0 : from;
    to = to == null ? lines.length : to;
    var secs = [];
    for (var k = 0; k < headings.length; k++) {
      var h = headings[k];
      if (h.level !== level || h.index < from || h.index >= to) continue;
      var end = to;
      for (var j = k + 1; j < headings.length; j++) {
        if (headings[j].index >= to) break;
        if (headings[j].level <= level) { end = headings[j].index; break; }
      }
      var chain = [];
      var minLv = level;
      for (var b = k - 1; b >= 0; b--) {
        var p = headings[b];
        if (p.index < from) break;
        if (p.level < minLv) { chain.unshift(p.title); minLv = p.level; }
      }
      secs.push({
        title: h.title,
        body: trimBlank(lines.slice(h.index + 1, end).join('\n')),
        path: chain,
        start: h.index + 1,
        end: end,
        headingIndex: h.index
      });
    }
    return secs;
  }

  function chooseLevel(headings, lines, maxCardLen) {
    if (!headings.length) return 0;
    var cands = [];
    for (var L = 1; L <= 5; L++) {
      var count = 0;
      for (var i = 0; i < headings.length; i++) if (headings[i].level === L) count++;
      if (count < 2) continue;
      var secs = sectionsAt(lines, headings, L);
      var lens = [];
      for (var s = 0; s < secs.length; s++) lens.push(secs[s].body.length);
      lens.sort(function (a, b) { return a - b; });
      cands.push({ level: L, count: count, med: lens.length ? lens[Math.floor(lens.length / 2)] : 0 });
    }
    if (!cands.length) return 0;
    var good = [];
    for (var g = 0; g < cands.length; g++) {
      if (cands[g].count >= 3 && cands[g].med <= maxCardLen) good.push(cands[g]);
    }
    if (good.length) {
      good.sort(function (a, b) { return b.level - a.level; });
      return good[0].level;
    }
    cands.sort(function (a, b) { return (b.count - a.count) || (a.level - b.level); });
    return cands[0].level;
  }

  /* ============================== 问答（Q/A）识别 ============================== */

  var Q_KEYS = 'Question|Q|问题|问|题目|考点';
  var A_KEYS = 'Answer|答案|A|解答|解析|答';

  function marker(keySource) {
    // 允许： "Q: ..." "**Q:** ..." "- Q：..." "> 问：..." "Q1、..." "**题目：** ..."
    return new RegExp(
      '^[ \\t>*-]{0,4}(?:\\*\\*|__)?[ \\t]*(?:' + keySource + ')[ \\t]*\\d*[ \\t]*(?::|：)?[ \\t]*(?:\\*\\*|__)?[ \\t]*(?::|：)?[ \\t]*',
      'i'
    );
  }
  var RE_Q = marker(Q_KEYS);
  var RE_A = marker(A_KEYS);

  function extractQA(lines, mask, from, to) {
    from = from == null ? 0 : from;
    to = to == null ? lines.length : to;
    var pairs = [];
    var cur = null;
    var target = null;

    function flush() {
      if (cur && (cur.q.trim() || cur.a.trim())) pairs.push(cur);
      cur = null;
      target = null;
    }

    for (var i = from; i < to; i++) {
      var line = lines[i];
      if (mask[i]) {
        if (cur && target) cur[target] += (cur[target] ? '\n' : '') + line;
        continue;
      }
      var m;
      if ((m = RE_Q.exec(line)) && (m[0].length > 0)) {
        flush();
        cur = { q: line.slice(m[0].length), a: '' };
        target = 'q';
        continue;
      }
      if ((m = RE_A.exec(line)) && (m[0].length > 0)) {
        if (!cur) cur = { q: '', a: '' };
        target = 'a';
        cur.a += (cur.a ? '\n' : '') + line.slice(m[0].length);
        continue;
      }
      if (cur && target) cur[target] += '\n' + line;
    }
    flush();

    var out = [];
    for (var p = 0; p < pairs.length; p++) {
      var q = trimBlank(pairs[p].q);
      var a = trimBlank(pairs[p].a);
      if (q && a) out.push({ q: q, a: a });
    }
    return out;
  }

  /* ============================== 段落切块 ============================== */

  function chunkParagraphs(lines, mask, from, to, maxLen) {
    var paragraphs = [];
    var buf = [];
    for (var i = from; i < to; i++) {
      var line = lines[i];
      if (!line.trim()) {
        if (buf.length) { paragraphs.push(buf.join('\n')); buf = []; }
        continue;
      }
      buf.push(line);
    }
    if (buf.length) paragraphs.push(buf.join('\n'));

    var chunks = [];
    var cur = '';
    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      if (cur && (cur.length + para.length + 2) > maxLen) {
        chunks.push(cur);
        cur = para;
      } else {
        cur = cur ? cur + '\n\n' + para : para;
      }
    }
    if (cur) chunks.push(cur);
    return chunks;
  }

  /* ============================== 提问生成（让标题不像标题时也能提问） ============================== */

  var QSTYLES = ['prompt', 'title', 'cloze'];

  var QUESTION_HINT = /(\?|？|为什么|为何|如何|怎么|怎样|什么是|是什么|有哪些|哪些|区别|对比|异同|原理|作用|优缺点|流程|步骤|实现|设计|能否|是否|说说|解释|介绍)/;

  function isQuestionLike(title) {
    return QUESTION_HINT.test(String(title || ''));
  }

  // 标题不是疑问句时，按内容特征套一个「像面试题」的提问模板
  function pickTemplate(title, body) {
    var t = cleanInline(title);
    var text = String(body || '');
    var plain = cleanInline(text.replace(/```[\s\S]*?```/g, ' ')).slice(0, 60);

    if (/区别|对比|异同|vs|VS|比较/.test(t)) return '「' + t + '」和相近概念有什么区别？';
    if (/流程|步骤|过程|链路|生命周期/.test(t)) return '说一下「' + t + '」的完整流程？';
    if (/原理|机制|底层|实现/.test(t)) return '「' + t + '」的原理是什么？';
    if (/作用|用途|场景|为什么用|意义/.test(t)) return '「' + t + '」有什么用，为什么需要它？';
    if (/优缺点|优劣|利弊|注意|坑/.test(t)) return '「' + t + '」的优缺点和注意事项有哪些？';

    var listCount = (text.match(/^\s*(?:[-*+]|\d{1,2}[.)])\s+\S/gm) || []).length;
    if (listCount >= 3) return '「' + t + '」包含哪几个要点？';
    if (text.indexOf('|') >= 0 && /\|\s*:?-{2,}/.test(text)) return '从表格看，「' + t + '」的关键差异是什么？';
    if (/^(?:是|指|即|所谓)/.test(plain)) return '「' + t + '」是什么？';

    return '不看答案，说说「' + t + '」的核心内容？';
  }

  // 把答案里的加粗词 / 行内代码挖空，生成"填空题"题面
  function makeCloze(body) {
    var text = String(body || '');
    if (!text || text.length > 1500) return '';
    if (/```|~~~/.test(text)) return '';
    var count = 0;
    var out = text.replace(/\*\*([^*\n]{2,40})\*\*/g, function () { count++; return '____'; });
    out = out.replace(/`([^`\n]{2,40})`/g, function () { count++; return '____'; });
    if (count < 2) return '';
    return out;
  }

  /**
   * style:
   *   title  —— 不生成题面（标题即题面）
   *   prompt —— 标题不是疑问句时生成一句提问
   *   cloze  —— 优先挖空，挖不出来再退回提问
   * 标题本身已经是疑问句时，不再重复生成题面。
   */
  function makeQuestion(title, body, style) {
    style = style || 'prompt';
    var t = cleanInline(title);
    if (!t || style === 'title') return '';
    if (style === 'cloze') {
      var cloze = makeCloze(body);
      if (cloze) return '填空回顾（说出横线处的内容）：\n\n' + cloze;
    }
    if (isQuestionLike(t)) return '';
    return pickTemplate(t, body);
  }

  /* ============================== 拆卡主流程 ============================== */

  var MODES = ['auto', 'h1', 'h2', 'h3', 'qa', 'hr', 'para'];

  function frontFromChunk(text) {
    var firstLine = '';
    var ls = String(text).split('\n');
    for (var i = 0; i < ls.length; i++) {
      var t = ls[i].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/^\s*#{1,6}\s+/, '').trim();
      if (t) { firstLine = t; break; }
    }
    firstLine = cleanInline(firstLine);
    return firstLine ? truncate(firstLine, 90) : '（回忆这一段的内容）';
  }

  function cardsFromLevel(lines, mask, headings, level, opts, out) {
    var secs = sectionsAt(lines, headings, level);
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      var body = sec.body;
      var qa = opts.useQA ? extractQA(lines, mask, sec.start, sec.end) : [];

      if (qa.length >= 1) {
        for (var q = 0; q < qa.length; q++) {
          out.push({ title: sec.title, question: qa[q].q, answer: qa[q].a, path: sec.path });
        }
        continue;
      }

      if (body.length > opts.maxCardLen * 1.5) {
        // 1) 尝试用更深一层标题继续拆
        var childLevel = 0;
        for (var h = 0; h < headings.length; h++) {
          var hh = headings[h];
          if (hh.index > sec.start && hh.index < sec.end && hh.level > level) {
            if (!childLevel || hh.level < childLevel) childLevel = hh.level;
          }
        }
        if (childLevel && opts.depth < 2) {
          var subOpts = Object.assign({}, opts, { depth: opts.depth + 1 });
          var subOut = [];
          var subs = sectionsAt(lines, headings, childLevel, sec.start, sec.end);
          if (subs.length >= 2) {
            for (var k = 0; k < subs.length; k++) {
              var kid = subs[k];
              if (!kid.body.trim()) continue;
              var kidQA = opts.useQA ? extractQA(lines, mask, kid.start, kid.end) : [];
              var basePath = sec.path.concat([sec.title]);
              if (kidQA.length >= 1) {
                for (var kq = 0; kq < kidQA.length; kq++) {
                  subOut.push({ title: kid.title, question: kidQA[kq].q, answer: kidQA[kq].a, path: basePath });
                }
              } else {
                subOut.push({ title: kid.title, question: '', answer: kid.body, path: basePath });
              }
            }
            for (var so = 0; so < subOut.length; so++) out.push(subOut[so]);
            continue;
          }
        }
        // 2) 按段落切块
        var chunks = chunkParagraphs(lines, mask, sec.start, sec.end, opts.maxCardLen);
        if (chunks.length > 1) {
          for (var c = 0; c < chunks.length; c++) {
            out.push({
              title: sec.title + ' (' + (c + 1) + '/' + chunks.length + ')',
              question: frontFromChunk(chunks[c]),
              answer: chunks[c],
              path: sec.path
            });
          }
          continue;
        }
      }

      out.push({ title: sec.title, question: '', answer: body, path: sec.path });
    }
  }

  function cardsFromHr(lines, mask, opts) {
    var cuts = [];
    for (var i = 0; i < lines.length; i++) {
      if (!mask[i] && /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/.test(lines[i])) cuts.push(i);
    }
    var ranges = [];
    var prev = 0;
    for (var c = 0; c < cuts.length; c++) { ranges.push([prev, cuts[c]]); prev = cuts[c] + 1; }
    ranges.push([prev, lines.length]);

    var out = [];
    for (var r = 0; r < ranges.length; r++) {
      var from = ranges[r][0], to = ranges[r][1];
      var qa = extractQA(lines, mask, from, to);
      if (qa.length >= 1) {
        for (var q = 0; q < qa.length; q++) out.push({ title: '', question: qa[q].q, answer: qa[q].a, path: [] });
        continue;
      }
      var text = trimBlank(lines.slice(from, to).join('\n'));
      if (!text) continue;
      var front = frontFromChunk(text);
      var rest = text.slice(text.indexOf('\n') + 1);
      out.push({
        title: '',
        question: front,
        answer: rest.trim() ? rest.trim() : text,
        path: []
      });
    }
    return out;
  }

  function cardsFromParagraphs(lines, mask, opts, from) {
    from = from || 0;
    var chunks = chunkParagraphs(lines, mask, from, lines.length, opts.maxCardLen);
    var out = [];
    for (var i = 0; i < chunks.length; i++) {
      out.push({ title: '', question: frontFromChunk(chunks[i]), answer: chunks[i], path: [] });
    }
    return out;
  }

  function finalizeCards(rawCards, opts) {
    var used = Object.create(null);
    var cards = [];
    for (var i = 0; i < rawCards.length; i++) {
      var c = rawCards[i];
      var answer = trimBlank(c.answer || '');
      var question = trimBlank(c.question || '');
      var title = cleanInline(c.title || '');
      if (!answer && !question) continue;
      if (!answer) answer = title;
      if (!title) title = question ? truncate(cleanInline(question), 40) : ('知识点 ' + (i + 1));
      if (!question) {
        question = makeQuestion(title, answer, opts.qstyle);
      }

      var key = title + '|' + question + '|' + answer;
      var id = 'c' + hash32(key);
      if (used[id]) {
        var n = used[id] + 1;
        used[id] = n;
        id = id + '-' + n;
      } else {
        used[id] = 1;
      }
      var path = [];
      if (c.path) {
        for (var p = 0; p < c.path.length; p++) {
          var pv = cleanInline(c.path[p]);
          if (pv) path.push(pv);
        }
      }
      cards.push({
        id: id,
        title: title,
        question: question,
        answer: answer,
        path: path
      });
    }
    return cards;
  }

  function parseMarkdown(text, options) {
    var opts = Object.assign({
      mode: 'auto',
      maxCardLen: 1600,
      useQA: true,
      qstyle: 'prompt',
      depth: 0
    }, options || {});
    if (MODES.indexOf(opts.mode) < 0) opts.mode = 'auto';
    if (QSTYLES.indexOf(opts.qstyle) < 0) opts.qstyle = 'prompt';

    var normalized = normalize(text);
    var stripped = stripFrontMatter(normalized);
    var bodyText = stripped.body;
    var lines = bodyText.split('\n');
    var mask = codeMask(lines);
    var headings = collectHeadings(lines, mask);

    var docTitle = '';
    if (headings.length && headings[0].index <= 2 && headings[0].level <= 2) docTitle = headings[0].title;

    var raw = [];
    var modeUsed = opts.mode;

    if (opts.mode === 'qa') {
      var qaAll = extractQA(lines, mask, 0, lines.length);
      for (var i = 0; i < qaAll.length; i++) raw.push({ title: '', question: qaAll[i].q, answer: qaAll[i].a, path: [] });
    } else if (opts.mode === 'hr') {
      raw = cardsFromHr(lines, mask, opts);
    } else if (opts.mode === 'para') {
      raw = cardsFromParagraphs(lines, mask, opts);
    } else {
      var level = 0;
      if (opts.mode === 'h1') level = 1;
      else if (opts.mode === 'h2') level = 2;
      else if (opts.mode === 'h3') level = 3;
      else level = chooseLevel(headings, lines, opts.maxCardLen);

      if (level) {
        cardsFromLevel(lines, mask, headings, level, opts, raw);
        modeUsed = 'h' + level;
      }
      if (!raw.length && opts.mode === 'auto') {
        var qa2 = extractQA(lines, mask, 0, lines.length);
        if (qa2.length >= 1) {
          for (var q2 = 0; q2 < qa2.length; q2++) raw.push({ title: '', question: qa2[q2].q, answer: qa2[q2].a, path: [] });
          modeUsed = 'qa';
        }
      }
      if (!raw.length && opts.mode === 'auto') {
        var hrCards = cardsFromHr(lines, mask, opts);
        // 只有真的存在 --- 分隔（产生多块）才走分隔线模式，否则继续用段落兜底
        if (hrCards.length > 1) { raw = hrCards; modeUsed = 'hr'; }
      }
      if (!raw.length && opts.mode === 'auto') {
        // 文档只有一个开头的标题（如 h1/h2 标题）时，把它当标题而不是正文
        var paraFrom = 0;
        var soleTitle = null;
        if (headings.length === 1 && headings[0].index <= 2 && headings[0].level <= 2) {
          soleTitle = headings[0];
          paraFrom = headings[0].index + 1;
        }
        var restBody = trimBlank(lines.slice(paraFrom).join('\n'));
        if (soleTitle && restBody.length <= opts.maxCardLen * 1.5) {
          raw.push({ title: soleTitle.title, question: '', answer: restBody, path: [] });
          modeUsed = 'h1';
        } else if (soleTitle) {
          var soloChunks = chunkParagraphs(lines, mask, paraFrom, lines.length, opts.maxCardLen);
          for (var sc = 0; sc < soloChunks.length; sc++) {
            raw.push({
              title: soleTitle.title + (soloChunks.length > 1 ? ' (' + (sc + 1) + '/' + soloChunks.length + ')' : ''),
              question: '',
              answer: soloChunks[sc],
              path: []
            });
          }
          modeUsed = 'para';
        } else {
          raw = cardsFromParagraphs(lines, mask, opts, paraFrom);
          modeUsed = 'para';
        }
      }
    }

    var cards = finalizeCards(raw, opts);
    return {
      version: CORE_VERSION,
      title: docTitle || '',
      cards: cards,
      modeUsed: modeUsed,
      headingCount: headings.length,
      charCount: bodyText.length
    };
  }

  /* ============================== Markdown 渲染（安全，无外部依赖） ============================== */

  var RE_FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)\s*$/;
  var RE_HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
  var RE_HR = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
  var RE_QUOTE = /^\s{0,3}>[ \t]?/;
  var RE_LIST = /^(\s*)([-*+]|\d{1,3}[.)])[ \t]+(.*)$/;
  var RE_TABLE_SEP = /^\s*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/;

  function splitRow(line) {
    var s = String(line).trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map(function (c) {
      return c.replace(/\\\|/g, '|').trim();
    });
  }

  function safeUrl(url) {
    var u = String(url || '').trim();
    if (!u) return false;
    if (/^(?:javascript|data|vbscript):/i.test(u)) return false;
    return /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u);
  }

  function makeInline() {
    var codes = [];
    function inline(text) {
      var s = escapeHtml(text);
      s = s.replace(/`([^`\n]+)`/g, function (m, code) {
        codes.push(code);
        return '\u0001' + (codes.length - 1) + '\u0002';
      });
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (m, alt, url) {
        return safeUrl(url) ? '<img src="' + url + '" alt="' + alt + '" loading="lazy">' : alt;
      });
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (m, label, url) {
        return safeUrl(url) ? '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>' : label;
      });
      s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
      s = s.replace(/__([^_\n]+)__/g, '<b>$1</b>');
      s = s.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
      s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
      s = s.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<i>$2</i>');
      s = s.replace(/\u0001(\d+)\u0002/g, function (m, n) {
        return '<code>' + codes[+n] + '</code>';
      });
      return s;
    }
    return inline;
  }

  function renderMarkdown(markdown) {
    var src = normalize(markdown).trim();
    if (!src) return '';
    var lines = src.split('\n');
    var inline = makeInline();
    var blocks = [];
    var i = 0;

    function isBlockStart(idx) {
      var l = lines[idx];
      if (l == null) return true;
      if (!l.trim()) return true;
      if (RE_FENCE.test(l)) return true;
      if (RE_HEADING.test(l)) return true;
      if (RE_HR.test(l)) return true;
      if (RE_QUOTE.test(l)) return true;
      if (RE_LIST.test(l)) return true;
      if (l.indexOf('|') >= 0 && lines[idx + 1] != null && RE_TABLE_SEP.test(lines[idx + 1])) return true;
      return false;
    }

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; }

      var m = RE_FENCE.exec(line);
      if (m) {
        var fch = m[1].charAt(0);
        var flen = m[1].length;
        var lang = m[2] || '';
        var buf = [];
        i++;
        while (i < lines.length) {
          var t = lines[i];
          var closeRe = new RegExp('^\\s{0,3}' + (fch === '`' ? '`' : '~') + '{' + flen + ',}[ \\t]*$');
          if (closeRe.test(t)) { i++; break; }
          buf.push(t);
          i++;
        }
        blocks.push({ type: 'code', lang: lang, text: buf.join('\n') });
        continue;
      }

      m = RE_HEADING.exec(line);
      if (m) {
        blocks.push({ type: 'heading', level: m[1].length, text: m[2].replace(/[ \t]+#+[ \t]*$/, '') });
        i++;
        continue;
      }

      if (RE_HR.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }

      if (line.indexOf('|') >= 0 && lines[i + 1] != null && RE_TABLE_SEP.test(lines[i + 1])) {
        var rows = [splitRow(line)];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') >= 0) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        blocks.push({ type: 'table', rows: rows });
        continue;
      }

      if (RE_QUOTE.test(line)) {
        var qbuf = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          qbuf.push(lines[i].replace(RE_QUOTE, ''));
          i++;
        }
        blocks.push({ type: 'quote', text: qbuf.join('\n') });
        continue;
      }

      m = RE_LIST.exec(line);
      if (m) {
        var items = [];
        while (i < lines.length) {
          var lm = RE_LIST.exec(lines[i]);
          if (!lm) {
            if (/^\s+\S/.test(lines[i]) && items.length) {
              items[items.length - 1].text += '\n' + lines[i].trim();
              i++;
              continue;
            }
            break;
          }
          items.push({
            indent: lm[1].replace(/\t/g, '    ').length,
            marker: lm[2],
            ordered: /\d/.test(lm[2]),
            text: lm[3]
          });
          i++;
        }
        blocks.push({ type: 'list', items: items });
        continue;
      }

      var pbuf = [];
      while (i < lines.length && !isBlockStart(i)) { pbuf.push(lines[i]); i++; }
      if (!pbuf.length) { pbuf.push(lines[i]); i++; }
      blocks.push({ type: 'p', text: pbuf.join('\n') });
    }

    var html = '';
    for (var b = 0; b < blocks.length; b++) {
      var blk = blocks[b];
      if (blk.type === 'code') {
        var langAttr = blk.lang ? ' data-lang="' + escapeHtml(blk.lang) + '"' : '';
        html += '<pre class="md-code"' + langAttr + '><code>' + escapeHtml(blk.text) + '</code></pre>';
      } else if (blk.type === 'heading') {
        var lv = Math.min(blk.level + 1, 6);
        html += '<div class="md-h md-h' + lv + '">' + inline(blk.text) + '</div>';
      } else if (blk.type === 'hr') {
        html += '<div class="md-hr"></div>';
      } else if (blk.type === 'quote') {
        html += '<blockquote>' + inline(blk.text).replace(/\n/g, '<br>') + '</blockquote>';
      } else if (blk.type === 'table') {
        html += '<div class="md-table"><table>';
        for (var r = 0; r < blk.rows.length; r++) {
          var tag = r === 0 ? 'th' : 'td';
          var rowTag = r === 0 ? 'thead' : 'tbody';
          if (r === 0) html += '<thead><tr>';
          if (r === 1) html += '<tbody><tr>';
          if (r > 1) html += '<tr>';
          for (var c = 0; c < blk.rows[r].length; c++) {
            html += '<' + tag + '>' + inline(blk.rows[r][c]) + '</' + tag + '>';
          }
          html += '</tr>';
          if (r === 0) html += '</thead>';
        }
        html += '</tbody></table></div>';
      } else if (blk.type === 'list') {
        html += '<div class="md-list">';
        for (var it = 0; it < blk.items.length; it++) {
          var item = blk.items[it];
          var depth = Math.min(4, Math.floor(item.indent / 2));
          var mk = item.ordered ? escapeHtml(item.marker) : '•';
          html += '<div class="md-li" style="--indent:' + depth + '">' +
            '<span class="md-mk">' + mk + '</span>' +
            '<span class="md-li-t">' + inline(item.text).replace(/\n/g, '<br>') + '</span></div>';
        }
        html += '</div>';
      } else {
        html += '<p>' + inline(blk.text).replace(/\n/g, '<br>') + '</p>';
      }
    }
    return html;
  }

  function renderInline(text) {
    return makeInline()(String(text == null ? '' : text));
  }

  function plainText(markdown) {
    return cleanInline(String(markdown || '').replace(/```[\s\S]*?```/g, ' ').replace(/\n+/g, ' '));
  }

  /* ============================== ZIP 解包（手机端批量导入用） ============================== */

  var ZIP_TEXT_EXT = /\.(md|markdown|txt)$/i;

  function decodeBytes(bytes) {
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  }

  function decodeZipName(bytes, utf8Flag) {
    if (utf8Flag) return decodeBytes(bytes);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) { /* 不是合法 UTF-8，继续尝试 GBK */ }
    try {
      return new TextDecoder('gbk').decode(bytes);
    } catch (e) { /* 浏览器不支持 gbk 时退回 utf-8 */ }
    return decodeBytes(bytes);
  }

  function inflateRawEntry(data) {
    return new Promise(function (resolve, reject) {
      if (typeof DecompressionStream === 'undefined') {
        reject(new Error('当前浏览器不支持 zip 解压（DecompressionStream），请升级浏览器或改选 md 文件'));
        return;
      }
      try {
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        new Response(stream).arrayBuffer().then(function (buf) {
          resolve(new Uint8Array(buf));
        }, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 解析 zip（stored / deflate），返回其中的文本文件 [{name, bytes}]
   * @param {ArrayBuffer} buffer
   * @param {RegExp} filter 文件名过滤，默认 md/markdown/txt
   */
  function unzipFiles(buffer, filter) {
    return new Promise(function (resolve, reject) {
      var view;
      var bytes;
      try {
        bytes = new Uint8Array(buffer);
        view = new DataView(buffer);
      } catch (e) {
        reject(new Error('文件读取失败'));
        return;
      }
      var eocd = -1;
      var minPos = Math.max(0, bytes.length - 65558);
      for (var i = bytes.length - 22; i >= minPos; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) {
        reject(new Error('不是有效的 zip 文件'));
        return;
      }
      var count = view.getUint16(eocd + 10, true);
      var cdOffset = view.getUint32(eocd + 16, true);
      var accept = filter || ZIP_TEXT_EXT;
      var entries = [];
      var p = cdOffset;
      for (var k = 0; k < count; k++) {
        if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) break;
        var flags = view.getUint16(p + 8, true);
        var method = view.getUint16(p + 10, true);
        var compSize = view.getUint32(p + 20, true);
        var nameLen = view.getUint16(p + 28, true);
        var extraLen = view.getUint16(p + 30, true);
        var commentLen = view.getUint16(p + 32, true);
        var localOff = view.getUint32(p + 42, true);
        var nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
        var name = decodeZipName(nameBytes, !!(flags & 0x800));
        p += 46 + nameLen + extraLen + commentLen;

        if (!name || name.slice(-1) === '/') continue;
        if (name.indexOf('__MACOSX/') === 0) continue;
        var base = name.split('/').pop();
        if (!base || base.charAt(0) === '.') continue;
        if (!accept.test(name)) continue;
        if (localOff + 30 > bytes.length || view.getUint32(localOff, true) !== 0x04034b50) continue;
        var lNameLen = view.getUint16(localOff + 26, true);
        var lExtraLen = view.getUint16(localOff + 28, true);
        var dataStart = localOff + 30 + lNameLen + lExtraLen;
        if (dataStart + compSize > bytes.length) continue;
        entries.push({ name: name, method: method, data: bytes.subarray(dataStart, dataStart + compSize) });
      }
      if (!entries.length) {
        resolve([]);
        return;
      }
      Promise.all(entries.map(function (en) {
        if (en.method === 0) return Promise.resolve({ name: en.name, bytes: en.data });
        if (en.method === 8) {
          return inflateRawEntry(en.data).then(function (out) { return { name: en.name, bytes: out }; });
        }
        return Promise.resolve(null);
      })).then(function (list) {
        resolve(list.filter(Boolean));
      }, reject);
    });
  }

  // 解压并解码成文本：[{name, text}]
  function unzipTextFiles(buffer) {
    return unzipFiles(buffer).then(function (list) {
      return list.map(function (en) {
        return { name: en.name, text: decodeBytes(en.bytes) };
      });
    });
  }

  /* ============================== 生成 deck ============================== */

  function buildDeck(name, text, options) {
    var parsed = parseMarkdown(text, options);
    var deckName = String(name || '').replace(/\.(md|markdown|txt)$/i, '').trim() || '未命名笔记';
    return {
      id: 'd' + hash32(deckName + '|' + (text || '').length + '|' + parsed.cards.length),
      name: deckName,
      title: parsed.title || deckName,
      createdAt: Date.now(),
      mode: parsed.modeUsed,
      qstyle: (options && options.qstyle) || 'prompt',
      raw: text,
      cards: parsed.cards
    };
  }

  var API = {
    version: CORE_VERSION,
    MODES: MODES,
    QSTYLES: QSTYLES,
    hash32: hash32,
    escapeHtml: escapeHtml,
    normalize: normalize,
    parseMarkdown: parseMarkdown,
    renderMarkdown: renderMarkdown,
    renderInline: renderInline,
    plainText: plainText,
    buildDeck: buildDeck,
    extractQA: extractQA,
    chooseLevel: chooseLevel,
    codeMask: codeMask,
    makeQuestion: makeQuestion,
    makeCloze: makeCloze,
    isQuestionLike: isQuestionLike,
    pickTemplate: pickTemplate,
    unzipFiles: unzipFiles,
    unzipTextFiles: unzipTextFiles
  };

  global.MDReviewCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
