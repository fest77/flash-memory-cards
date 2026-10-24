/* 生成截图用的页面：从构建产物派生，注入示例数据并进入指定界面 */
(function () {
  'use strict';

  var MODE = window.__SHOT_MODE__ || 'home';
  var SAMPLE = [
    '# 计算机网络 · 面试题',
    '',
    '## TCP 为什么需要三次握手？',
    '',
    '两次握手无法确认「客户端的接收能力」，也无法识别「失效的历史连接请求」：',
    '',
    '1. 防止已失效的连接请求报文突然传到服务端，造成资源浪费；',
    '2. 三次握手后双方都确认了对方的发送与接收能力正常。',
    '',
    '## HTTP 和 HTTPS 的区别',
    '',
    '| 维度 | HTTP | HTTPS |',
    '| --- | --- | --- |',
    '| 加密 | 明文传输 | TLS 加密 |',
    '| 端口 | 80 | 443 |',
    '| 证书 | 无 | 需 CA 证书 |',
    '',
    '## 进程和线程的区别',
    '',
    'Q: 进程和线程最核心的区别是什么？',
    'A: 进程是资源分配的基本单位，线程是 CPU 调度的基本单位；同一进程内的线程共享地址空间，切换开销更小。',
    '',
    'Q: 协程和线程的区别？',
    'A: 协程是用户态调度，切换不需要内核参与，开销远小于线程。',
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
    '→ 层数低（3~4 层可存千万级），磁盘 IO 次数少，范围查询友好',
    '```',
    '',
    '对比哈希索引：只适合等值查询，不支持范围查询与排序。'
  ].join('\n');

  var started = Date.now();
  (function wait() {
    var app = window.MDReviewApp;
    if (app && app.state && app.state()) {
      start(app);
      return;
    }
    if (Date.now() - started > 10000) {
      document.title = 'SHOT-TIMEOUT';
      return;
    }
    setTimeout(wait, 50);
  })();

  function start(app) {
    try {
      app.importText('计算机网络 · 面试题', SAMPLE, { mode: 'auto', gran: 'mid' });
      if (MODE === 'quick' || MODE === 'quicktoc') {
        setTimeout(function () {
          var bd = app.state().decks.filter(function (x) { return x.bundled; })[0];
          if (bd) app.openQuick(bd.id);
          if (MODE === 'quicktoc') {
            setTimeout(function () {
              var toc = document.querySelector('[data-act="quick-toc"]');
              if (toc) toc.click();
            }, 200);
          }
        }, 200);
      } else if (MODE !== 'home') {
        setTimeout(function () {
          var btn = document.querySelector('[data-act="review"]');
          if (btn) btn.click();
          if (MODE === 'answer') {
            setTimeout(function () {
              var show = document.querySelector('[data-act="show-answer"]');
              if (show) show.click();
            }, 120);
          }
        }, 120);
      }
      setTimeout(function () { document.title = 'SHOT-' + MODE + '-READY'; }, MODE === 'home' ? 300 : 800);
    } catch (e) {
      document.title = 'SHOT-ERROR';
    }
  }
})();
