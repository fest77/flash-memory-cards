'use strict';
const assert = require('assert');
const path = require('path');
const C_zipStore = require('../src/core.js').zipStore;
const Core = require(path.join(__dirname, '..', 'src', 'core.js'));

let pass = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ' + name);
  } catch (e) {
    failures.push({ name, error: e });
    console.log('FAIL  ' + name + '\n      ' + (e && e.message));
  }
}
function cardsOf(md, opts) {
  return Core.parseMarkdown(md, opts).cards;
}

/* ------------------------------------------------------------------ */
console.log('\n[1] 标题拆卡');
const headingDoc = `# 计算机网络

前言部分，不该单独成卡。

## TCP 三次握手

客户端发送 SYN，服务端回复 SYN+ACK，客户端再回 ACK。

### 为什么不是两次

防止历史连接请求造成资源浪费。

## HTTP 与 HTTPS 区别

HTTPS 在 HTTP 下加了 TLS 层。

\`\`\`js
// 下面这行是假标题，不能拆
## 这不是标题
const a = 1;
\`\`\`

## 进程与线程

进程是资源分配单位，线程是调度单位。
`;
test('h1 文档按 h2 拆分（短小节不再下拆）', () => {
  const res = Core.parseMarkdown(headingDoc);
  assert.strictEqual(res.cards.length, 3, '实际 ' + res.cards.length + ' 张：' + res.cards.map((c) => c.title).join('|'));
  const titles = res.cards.map((c) => c.title).join(' | ');
  assert.ok(titles.includes('TCP 三次握手'), titles);
  assert.ok(titles.includes('HTTP 与 HTTPS 区别'), titles);
  const tcp = res.cards.find((c) => c.title.includes('TCP'));
  assert.ok(tcp.answer.includes('历史连接请求'), 'h3 内容应并入 h2 卡片答案');
});
test('代码块里的 ## 不被当成标题', () => {
  const res = Core.parseMarkdown(headingDoc);
  assert.ok(!res.cards.some((c) => c.title.includes('这不是标题')), '出现了假标题卡');
  const httpCard = res.cards.find((c) => c.title.includes('HTTP'));
  assert.ok(httpCard.answer.includes('## 这不是标题'), '代码块内容应完整保留在答案里');
});
test('三级标题足够多时按 h3 拆并保留层级', () => {
  let md = '# 主题\n\n## 章节A\n\n';
  for (let i = 1; i <= 3; i++) md += '### 问题' + i + '\n\n答案' + i + ' 的详细内容。\n\n';
  md += '## 章节B\n\n### 问题四\n\n答案四。\n\n### 问题五\n\n答案五。\n\n### 问题六\n\n答案六。\n';
  const res = Core.parseMarkdown(md);
  const sub = res.cards.find((c) => c.title === '问题1');
  assert.ok(sub, '没找到三级标题卡：' + res.cards.map((c) => c.title).join('|'));
  assert.deepStrictEqual(sub.path, ['主题', '章节A']);
});

/* ------------------------------------------------------------------ */
console.log('\n[2] 问答拆分');
const qaDoc = `# 操作系统面试

## 1. 进程和线程的区别

Q: 进程和线程最核心的区别是什么？
A: 进程是资源分配的基本单位，线程是 CPU 调度的基本单位，同一进程内的线程共享地址空间。

Q: 协程和线程的区别？
A: 协程是用户态调度，切换开销远小于线程，不需要内核参与。

## 2. 死锁的四个必要条件

- 互斥
- 占有并等待
- 不可抢占
- 循环等待
`;
test('Q:/A: 被拆成多张卡', () => {
  const res = Core.parseMarkdown(qaDoc);
  const qaCards = res.cards.filter((c) => c.question);
  assert.ok(qaCards.length >= 2, '期望 >=2 张问答题，实际 ' + qaCards.length);
  assert.ok(qaCards[0].question.includes('最核心的区别'), qaCards[0].question);
  assert.ok(qaCards[0].answer.includes('资源分配'), qaCards[0].answer);
});
test('标题型小节仍然单独成卡', () => {
  const res = Core.parseMarkdown(qaDoc);
  const dead = res.cards.find((c) => c.title.includes('死锁'));
  assert.ok(dead, '死锁小节未成卡');
  assert.ok(dead.answer.includes('循环等待'));
});

test('中文全角冒号与加粗标记', () => {
  const md = `## 题目一
**问：** 什么是虚拟内存？
**答：** 把物理内存抽象成连续的地址空间。
`;
  const cards = cardsOf(md);
  assert.strictEqual(cards.length, 1, '实际 ' + cards.length);
  assert.ok(cards[0].question.includes('虚拟内存'), cards[0].question);
  assert.ok(cards[0].answer.includes('地址空间'), cards[0].answer);
});

/* ------------------------------------------------------------------ */
console.log('\n[3] 无标题的兜底');
test('长段落文档按段落切块', () => {
  let md = '';
  for (let i = 0; i < 12; i++) {
    md += '第 ' + i + ' 个知识点：' + '这是一段很长的解释文字，用来测试段落切块逻辑。'.repeat(6) + '\n\n';
  }
  const res = Core.parseMarkdown(md);
  assert.ok(res.cards.length >= 2, '段落兜底应至少 2 张卡，实际 ' + res.cards.length);
  assert.ok(res.cards.every((c) => c.answer.length > 0));
});
test('空文本不炸', () => {
  assert.deepStrictEqual(Core.parseMarkdown('').cards, []);
  assert.deepStrictEqual(Core.parseMarkdown('   \n\n  ').cards, []);
});
test('单行短文本至少一张卡', () => {
  const cards = cardsOf('TCP 三次握手：SYN, SYN-ACK, ACK。');
  assert.ok(cards.length >= 1);
});

/* ------------------------------------------------------------------ */
console.log('\n[4] 长小节二次拆分');
test('超长二级小节用三级标题继续拆', () => {
  let md = '# 标题\n\n## 大数据章节\n\n';
  for (let i = 0; i < 6; i++) {
    md += '### 子知识点 ' + i + '\n\n' + '这里是详细内容。'.repeat(120) + '\n\n';
  }
  const res = Core.parseMarkdown(md);
  assert.ok(res.cards.length >= 4, '应拆出多张卡，实际 ' + res.cards.length);
  assert.ok(res.cards.every((c) => c.answer.length <= 4000));
});
test('超长无子标题小节按段落切', () => {
  let md = '## 一个很长的知识点\n\n';
  for (let i = 0; i < 20; i++) md += '分段 ' + i + '：' + '内容内容内容内容。'.repeat(30) + '\n\n';
  const res = Core.parseMarkdown(md);
  assert.ok(res.cards.length >= 3, '实际 ' + res.cards.length);
  assert.ok(res.cards.every((c) => !c.title.startsWith('#')), '卡片标题不应带 # 号');
  assert.ok(res.cards.every((c) => c.answer.length > 0 && !c.answer.includes('# 一个很长的知识点')));
});

/* ------------------------------------------------------------------ */
console.log('\n[5] 卡片唯一性与稳定性');
test('同一内容两次解析 id 一致', () => {
  const a = cardsOf(headingDoc);
  const b = cardsOf(headingDoc);
  assert.deepStrictEqual(a.map((c) => c.id), b.map((c) => c.id));
});
test('重复内容 id 不冲突', () => {
  const md = '## 重复\n\n同样内容\n\n## 重复\n\n同样内容\n';
  const cards = cardsOf(md);
  const ids = cards.map((c) => c.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id 冲突: ' + ids.join(','));
});

/* ------------------------------------------------------------------ */
console.log('\n[6] Markdown 渲染');
test('代码块被转义且保留', () => {
  const html = Core.renderMarkdown('```js\nconst a = "<b>x</b>";\n```');
  assert.ok(html.includes('<pre class="md-code"'), html);
  assert.ok(html.includes('&lt;b&gt;'), '代码里的 HTML 必须转义');
});
test('XSS 被转义', () => {
  const html = Core.renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  assert.ok(!/<script/i.test(html), html);
  assert.ok(!/<img/i.test(html), html);
  assert.ok(html.includes('&lt;script&gt;'), html);
});
test('表格渲染', () => {
  const html = Core.renderMarkdown('| 名称 | 说明 |\n| --- | --- |\n| TCP | 可靠 |\n| UDP | 不可靠 |');
  assert.ok(html.includes('<table>'), html);
  assert.ok(html.includes('<th>名称</th>'), html);
  assert.ok(html.includes('<td>TCP</td>'), html);
});
test('行内格式', () => {
  const html = Core.renderMarkdown('**加粗** 与 `code` 与 *斜体* 与 [链接](https://example.com)');
  assert.ok(html.includes('<b>加粗</b>'), html);
  assert.ok(html.includes('<code>code</code>'), html);
  assert.ok(html.includes('<i>斜体</i>'), html);
  assert.ok(html.includes('href="https://example.com"'), html);
});
test('javascript: 链接被拒绝', () => {
  const html = Core.renderMarkdown('[点我](javascript:alert(1))');
  assert.ok(!html.includes('javascript:'), html);
});
test('列表渲染', () => {
  const html = Core.renderMarkdown('- 一\n- 二\n  - 二点一\n\n1. 甲\n2. 乙');
  assert.ok(html.includes('md-list'), html);
  assert.ok(html.includes('二点一'), html);
  assert.ok(html.includes('1.'), html);
});
test('未闭合代码块不吞掉渲染', () => {
  const html = Core.renderMarkdown('```js\nconst a = 1;');
  assert.ok(html.includes('md-code'), html);
});

/* ------------------------------------------------------------------ */
console.log('\n[7] deck 构建');
test('buildDeck 生成名称与卡', () => {
  const deck = Core.buildDeck('算法笔记.md', headingDoc);
  assert.strictEqual(deck.name, '算法笔记');
  assert.ok(deck.cards.length >= 3);
  assert.strictEqual(deck.title, '计算机网络');
});

/* ------------------------------------------------------------------ */
console.log('\n[8] 提问生成 / 挖空');
test('标题式不生成题面', () => {
  const cards = cardsOf('## TCP 握手\n\n三次握手的内容。', { qstyle: 'title' });
  assert.strictEqual(cards[0].question, '');
});
test('提问式：非疑问标题会生成提问', () => {
  const cards = cardsOf('## 三次握手\n\n三次握手的内容。', { qstyle: 'prompt' });
  assert.ok(cards[0].question.includes('三次握手'), cards[0].question);
  assert.ok(/？$/.test(cards[0].question), cards[0].question);
});
test('提问式：标题本身是疑问句不重复生成', () => {
  const cards = cardsOf('## TCP 为什么需要三次握手？\n\n内容。', { qstyle: 'prompt' });
  assert.strictEqual(cards[0].question, '');
});
test('列表型内容套用要点模板', () => {
  const md = '## 死锁条件\n\n- 互斥\n- 占有并等待\n- 不可抢占\n';
  const cards = cardsOf(md);
  assert.ok(cards[0].question.includes('要点'), cards[0].question);
});
test('挖空式掩掉加粗词，答案保持原文', () => {
  const md = '## 三次握手\n\n客户端发送 **SYN**，服务端回复 **SYN+ACK**，最后 **ACK**。';
  const cards = cardsOf(md, { qstyle: 'cloze' });
  assert.ok(cards[0].question.includes('____'), cards[0].question);
  assert.ok(cards[0].answer.includes('SYN+ACK'), cards[0].answer);
});
test('默认是提问式', () => {
  const cards = cardsOf('## 虚拟内存\n\n虚拟内存是给进程的抽象地址空间。');
  assert.ok(cards[0].question.length > 0, cards[0].question);
});
test('makeQuestion / isQuestionLike 导出可用', () => {
  assert.ok(Core.makeQuestion('进程', '进程是资源分配单位。', 'prompt').length > 0);
  assert.ok(Core.isQuestionLike('为什么用 B+ 树'));
  assert.ok(!Core.isQuestionLike('B+ 树'));
});

/* ------------------------------------------------------------------ */
const ZIP_B64 = 'UEsDBBQAAAAIACRMV11XkjbrigAAAJcAAAAMAAAAbm90ZXMvdGNwLm1kU1YIcQ5QeL5myot1G7i4lJUVnuzofLZm4bP+hc86u7m4nq5b9Kxj+/PV6xWCI/3e7+l5Nqf3addCKF/b0dkbKIZQA+Q/bmiCGrPrye6GJzs7nuzofTZj/ZMdS4CmcnG9nLHp2dpFT/vanvZverF/3rO+pS/Wb3+2senZ1lUvtux8sbXl2a4JICMAUEsDBBQAAAAIACRMV13q6RrmVQAAAFAAAAASAAAAbm90ZXMvZGVlcC9tZW0udHh0AVAAr/8jIOWGheWtmOeslOiusAoKIyMg6Jma5ouf5YaF5a2YCgrmr4/kuKrov5vnqIvni6znq4vlnLDlnYDnqbrpl7TvvIxNTVUg5pig5bCE44CCClBLAwQUAAAACAAkTFddOZz7BgYAAAAEAAAAEQAAAF9fTUFDT1NYLy5fdGNwLm1kyyrNywYAUEsDBBQAAAAIACRMV10EwL7RBgAAAAQAAAAQAAAAbm90ZXMvcmVhZG1lLnBkZlMNcHEDAFBLAQIUABQAAAAIACRMV11XkjbrigAAAJcAAAAMAAAAAAAAAAAAAACAAQAAAABub3Rlcy90Y3AubWRQSwECFAAUAAAACAAkTFdd6uka5lUAAABQAAAAEgAAAAAAAAAAAAAAgAG0AAAAbm90ZXMvZGVlcC9tZW0udHh0UEsBAhQAFAAAAAgAJExXXTmc+wYGAAAABAAAABEAAAAAAAAAAAAAAIABOQEAAF9fTUFDT1NYLy5fdGNwLm1kUEsBAhQAFAAAAAgAJExXXQTAvtEGAAAABAAAABAAAAAAAAAAAAAAAIABbgEAAG5vdGVzL3JlYWRtZS5wZGZQSwUGAAAAAAQABAD3AAAAogEAAAAA';
const zipBytes = Buffer.from(ZIP_B64, 'base64');
const zipAB = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);

(async () => {
  console.log('\n[9] zip 解包');
  const list = await Core.unzipTextFiles(zipAB);
  test('解出 md/txt 两个文件', () => {
    assert.strictEqual(list.length, 2, '实际 ' + list.length + '：' + list.map((x) => x.name).join(','));
  });
  test('跳过 __MACOSX 与 pdf', () => {
    assert.ok(!list.some((x) => x.name.includes('__MACOSX')), list.map((x) => x.name).join(','));
    assert.ok(!list.some((x) => x.name.endsWith('.pdf')), list.map((x) => x.name).join(','));
  });
  test('保留子目录与内容', () => {
    const names = list.map((x) => x.name).sort();
    assert.deepStrictEqual(names, ['notes/deep/mem.txt', 'notes/tcp.md']);
    const tcp = list.find((x) => x.name.endsWith('tcp.md'));
    assert.ok(tcp.text.includes('三次握手'), tcp.text.slice(0, 50));
  });
  test('坏 zip 会报错', async () => {
    let err = null;
    try { await Core.unzipFiles(new ArrayBuffer(24)); } catch (e) { err = e; }
    assert.ok(err, '应当抛错');
  });

  test('img 相对路径渲染', () => {
    assert.ok(/<img src="images\/a\.png"/.test(Core.renderMarkdown('![](images/a.png)')));
  });
  test('img ./ 相对路径渲染', () => {
    assert.ok(/<img src="\.\/pic\/b\.jpg"/.test(Core.renderMarkdown('![](./pic/b.jpg)')));
  });
  test('img javascript: 拒绝', () => {
    assert.ok(Core.renderMarkdown('![](javascript:alert(1))').indexOf('<img') < 0);
  });
  test('img 协议相对 // 拒绝', () => {
    assert.ok(Core.renderMarkdown('![](//evil.com/x.png)').indexOf('<img') < 0);
  });
  test('img http 外链保留', () => {
    assert.ok(/<img src="https:\/\/x\.test\/c\.png"/.test(Core.renderMarkdown('![](https://x.test/c.png)')));
  });

  test('Obsidian wiki 图片 ![[..]] 渲染', () => {
    assert.ok(/<img src="AI应用开发\/images\/image下（第5章）\/img001\.png"/.test(Core.renderMarkdown('![[AI应用开发/images/image下（第5章）/img001.png]]')));
  });
  test('wiki 图片带 |宽度 后缀', () => {
    assert.ok(/<img src="a\.png"/.test(Core.renderMarkdown('![[a.png|300]]')));
  });
  test('wiki 宽度转成 max-width 样式', () => {
    assert.ok(Core.renderMarkdown('![[a.png|300]]').indexOf('max-width:300px') >= 0);
    assert.ok(Core.renderMarkdown('![[a.png]]').indexOf('max-width') < 0);
  });
  test('renderInline 也支持 wiki 图片', () => {
    assert.ok(/<img src="b\.png"/.test(Core.renderInline('看图 ![[b.png]]')));
  });

  // Q/A 标记必须带分隔符：QPS/API/A/B/选择题选项不能被吃掉首字母
  test('QPS/API/A/B 不误识别为问答', () => {
    const md = '## 性能指标\n\nQPS: 每秒查询数。\nAPI: 应用程序接口。\nA/B 测试显示提升。\nA. 进程';
    const deck = Core.buildDeck('t', md, { mode: 'auto', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.answer.indexOf('QPS') >= 0), '正文应完整保留');
    assert.ok(!deck.cards.some((c) => c.question.indexOf('PS:') === 0), '不应吃掉 Q');
    assert.ok(!deck.cards.some((c) => c.answer.indexOf('PI:') === 0), '不应吃掉 A');
  });
  test('正常 Q:/A:/问：/答案： 仍识别', () => {
    const deck = Core.buildDeck('t', '## 事务\n\nQ: 默认隔离级别？\nA: 可重复读。\n\n问：MVCC 是什么？\n答案：多版本并发控制。', { mode: 'auto', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.question.indexOf('默认隔离级别') >= 0));
    assert.ok(deck.cards.some((c) => c.question.indexOf('MVCC') >= 0));
  });
  test('schedule：三盒递进与回退', () => {
    const now = 1700000000000, DAY = 86400000;
    let st = {};
    Object.assign(st, Core.schedule(st, 'ok', now));
    assert.strictEqual(st.box, 1); assert.strictEqual(st.ivl, 1);
    assert.ok(Math.abs(st.dueAt - (now + DAY)) < 1000);
    Object.assign(st, Core.schedule(st, 'ok', now));
    assert.strictEqual(st.box, 2); assert.strictEqual(st.ivl, 3);
    Object.assign(st, Core.schedule(st, 'ok', now));
    assert.strictEqual(st.box, 3); assert.strictEqual(st.ivl, 7); // 封顶
    Object.assign(st, Core.schedule(st, 'ok', now));
    assert.strictEqual(st.box, 3); // 不超 3
    Object.assign(st, Core.schedule(st, 'bad', now));
    assert.strictEqual(st.box, 1); assert.strictEqual(st.dueAt, now); // 立即到期
    Object.assign(st, Core.schedule(st, 'fuzzy', now));
    assert.ok(Math.abs(st.dueAt - (now + DAY)) < 1000); // 明天
  });
  test('isDue：旧卡/新卡视为今日到期', () => {
    const eot = 2000000000000;
    assert.strictEqual(Core.isDue(null, eot), true);
    assert.strictEqual(Core.isDue({}, eot), true); // 无 box
    assert.strictEqual(Core.isDue({ box: 1, dueAt: eot + 1 }, eot), false); // 明天
    assert.strictEqual(Core.isDue({ box: 1, dueAt: eot }, eot), true); // 今天
  });
  test('isMathCandidate：货币/纯数字/中文内容不当公式', () => {
    assert.strictEqual(Core.isMathCandidate('100'), false);
    assert.strictEqual(Core.isMathCandidate('100 和 200'), false);   // 含中文
    assert.strictEqual(Core.isMathCandidate('3.14'), false);          // 纯数字
    assert.strictEqual(Core.isMathCandidate('a+b=c'), true);
    assert.strictEqual(Core.isMathCandidate('\frac{1}{2}'), true);
    assert.strictEqual(Core.isMathCandidate('  '), false);
  });
  test('代码块渲染带复制按钮容器', () => {
    const F = String.fromCharCode(96, 96, 96);
    const html = Core.renderMarkdown(F + '\nvar x = 1;\n' + F);
    assert.ok(html.indexOf('data-act="code-copy"') >= 0);
    assert.ok(html.indexOf('md-code-wrap') >= 0);
  });
  test('zipStore/unzipFiles roundtrip（含中文与二进制）', async () => {
    const enc = new TextEncoder();
    const zip = C_zipStore([
      { name: 'backup.json', data: enc.encode(JSON.stringify({ ok: true, text: '中文内容' })) },
      { name: 'images/pic 1.png', data: new Uint8Array([137, 80, 78, 71, 13, 10]) },
    ]);
    const list = await Core.unzipFiles(zip.buffer.slice(0), /.*/);
    const dec = new TextDecoder();
    const bj = list.find((x) => x.name === 'backup.json');
    const img = list.find((x) => x.name === 'images/pic 1.png');
    assert.ok(bj && JSON.parse(dec.decode(bj.bytes)).text === '中文内容');
    assert.ok(img && img.bytes.length === 6 && img.bytes[0] === 137);
  });
  test('zipStore 空文件与重复名', async () => {
    const enc = new TextEncoder();
    const zip = C_zipStore([{ name: 'empty.txt', data: new Uint8Array(0) }, { name: 'empty.txt', data: enc.encode('x') }]);
    const list = await Core.unzipFiles(zip.buffer.slice(0), /.*/);
    assert.strictEqual(list.length, 2);
  });
  test('qa 模式问答卡保留标题链 path', () => {
    const deck = Core.buildDeck('t', '# 笔记\n\n## 第一章\n\nQ: a?\nA: b.\n\n## 第二章\n\nQ: c?\nA: d.', { mode: 'qa', maxCardLen: 1600, qstyle: 'prompt' });
    const paths = deck.cards.map((c) => c.path.join('/'));
    assert.ok(paths.includes('笔记/第一章'), paths.join(','));
    assert.ok(paths.includes('笔记/第二章'), paths.join(','));
  });
  test('Q/A 前的正文保留为概述卡', () => {
    const deck = Core.buildDeck('t', '## 事务隔离级别\n\n事务隔离级别共有四种，下面是重点：\n\nQ: 默认级别？\nA: 可重复读。', { mode: 'auto', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.answer.indexOf('四种') >= 0), '概述不应丢失');
    assert.ok(deck.cards.some((c) => c.question.indexOf('默认级别') >= 0));
  });
  test('Q1、/Q1. 数字编号形式仍识别', () => {
    const deck = Core.buildDeck('t', '## 练习\n\nQ1、什么是进程？\nA: 运行中的程序。\n\nQ2. 什么是线程？\nA: 调度单位。', { mode: 'auto', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.question.indexOf('什么是进程') >= 0));
    assert.ok(deck.cards.some((c) => c.question.indexOf('什么是线程') >= 0));
  });
  test('标题型卡的 title 是所属小节（快速阅读分组依据）', () => {
    const deck = Core.buildDeck('t', '# 大标题\n\n## 第一章\n\nQ: a?\nA: b.\n\n## 第二章\n\nQ: c?\nA: d.', { mode: 'auto', maxCardLen: 1600, qstyle: 'prompt' });
    const titles = deck.cards.map((c) => c.title);
    assert.ok(titles.includes('第一章') && titles.includes('第二章'), titles.join(','));
  });
  test('chapter 字段 = 所属小节（分组依据）', () => {
    const deck = Core.buildDeck('t', '# 大标题\n\n## 第一章\n\nQ: a?\nA: b.\n\n## 第二章\n\nQ: c?\nA: d.', { mode: 'auto', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.every((c) => c.chapter === '第一章' || c.chapter === '第二章'));
    assert.strictEqual(new Set(deck.cards.map((c) => c.chapter)).size, 2);
  });
  test('Q/A-only 笔记全部未分类（不一张卡一章）', () => {
    const deck = Core.buildDeck('t', 'Q: 什么是 TCP？\nA: 传输控制协议。\n\nQ: 什么是 UDP？\nA: 用户数据报协议。', { mode: 'qa', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.length >= 2);
    assert.ok(deck.cards.every((c) => !c.chapter), 'chapter 应为空');
  });
  test('qa 概览卡命名（与题目同组，都未分类）', () => {
    const deck = Core.buildDeck('t', '# 我的笔记\n\n背景介绍，这是开头的说明内容。\n\nQ: 一加一？\nA: 二。', { mode: 'qa', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.title === '我的笔记 · 概览'));
    assert.ok(deck.cards.every((c) => !c.chapter), 'chapter 应为空');
  });
  test('超长小节下拆时父小节前言保留', () => {
    let filler = '';
    for (let i = 0; i < 40; i++) filler += '填充说明文字，用于把小节撑到超过切块阈值。';
    const deck = Core.buildDeck('t', '# 大\n\n## 长小节\n' + filler + '\n\n### 子节一\n\nQ: 甲？\nA: 乙。\n\n### 子节二\n\nQ: 丙？\nA: 丁。\n\n## 短小节\n\n普通内容。', { mode: 'auto', maxCardLen: 800, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.title === '长小节' && c.answer.indexOf('填充说明') >= 0), '父小节前言不应丢失');
    assert.ok(deck.cards.some((c) => c.question.indexOf('甲') >= 0) && deck.cards.some((c) => c.question.indexOf('丙') >= 0));
  });
  test('父小节前言 off-by-one：标题后无空行的单行前言也保留', () => {
    let filler = '';
    for (let i = 0; i < 60; i++) filler += '填充说明文字，用于把小节撑到超过切块阈值。';
    const deck = Core.buildDeck('t', '# 大\n\n## 长小节\n前言第一行就一句话。\n' + filler + '\n\n### 子节一\n\n普通内容甲。\n\n### 子节二\n\n普通内容乙。\n\n## 短小节\n\n普通内容。', { mode: 'auto', maxCardLen: 800, qstyle: 'prompt' });
    assert.ok(deck.cards.some((c) => c.title === '长小节 · 概览' && c.answer.indexOf('前言第一行就一句话') >= 0));
  });
  test('段落切块分支的卡 chapter = 所属小节', () => {
    let filler = '';
    for (let i = 0; i < 30; i++) filler += '这是用来撑长度的段落内容，讲述该小节的核心知识点。';
    const deck = Core.buildDeck('t', '# 大\n\n## 长小节\n\n' + filler + '\n\n更多补充段落，继续展开说明。\n\n## 短小节\n\n普通内容。', { mode: 'auto', maxCardLen: 500, qstyle: 'prompt' });
    const chunks = deck.cards.filter((c) => /\(\d+\/\d+\)/.test(c.title));
    assert.ok(chunks.length >= 2, '应有切块卡');
    assert.ok(chunks.every((c) => c.chapter === '长小节'), chunks.map((c) => c.chapter).join(','));
  });
  test('qa 模式概览与题目同组（都未分类）', () => {
    const deck = Core.buildDeck('t', '# 网络笔记\n\n背景介绍，这是开头的说明内容。\n\nQ: 什么是 TCP？\nA: 传输控制协议。', { mode: 'qa', maxCardLen: 1600, qstyle: 'prompt' });
    assert.ok(deck.cards.every((c) => !c.chapter), 'chapter 应为空');
    assert.ok(deck.cards.some((c) => c.title === '网络笔记 · 概览'));
  });

  // 构造 stored zip（无压缩）用于测试 unzipFiles 的过滤器
  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
  function storedZip(files) {
    const parts = []; const central = []; let off = 0;
    for (const [name, data] of files) {
      const nb = Buffer.from(name);
      const h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 8);
      h.writeUInt32LE(crc32(data), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22);
      h.writeUInt16LE(nb.length, 26);
      parts.push(h, nb, data);
      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8);
      ch.writeUInt32LE(crc32(data), 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
      ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
      central.push(ch, nb);
      off += 30 + nb.length + data.length;
    }
    const cd = Buffer.concat(central); const cdOff = off;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt16LE(files.length, 8) ;
    eocd.writeUInt32LE(cdOff, 16); eocd.writeUInt32LE(cd.length, 12);
    return Buffer.concat([...parts, cd, eocd]);
  }

  test('unzipFiles 默认过滤器只收文本', async () => {
    const zip = storedZip([['images/p1.png', Buffer.from([1, 2, 3])], ['note.md', Buffer.from('hi')]]);
    const list = await Core.unzipFiles(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength));
    assert.deepStrictEqual(list.map((x) => x.name), ['note.md']);
  });
  test('unzipFiles 传过滤器时图片也解出', async () => {
    const zip = storedZip([['images/p1.png', Buffer.from([1, 2, 3])], ['note.md', Buffer.from('hi')]]);
    const re = /\.(md|markdown|txt|png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i;
    const list = await Core.unzipFiles(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength), re);
    assert.deepStrictEqual(list.map((x) => x.name).sort(), ['images/p1.png', 'note.md']);
  });

  console.log('\n============================');
  console.log('通过 ' + pass + ' / ' + (pass + failures.length));
  if (failures.length) {
    console.log('\n失败用例：');
    failures.forEach((f) => console.log(' - ' + f.name + ': ' + (f.error && f.error.message)));
    process.exit(1);
  }
})();
