'use strict';
const assert = require('assert');
const path = require('path');
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
