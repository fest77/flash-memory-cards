'use strict';
/**
 * 构建产物的静态检查 + headless Edge 冒烟测试
 * 用法: node test/run-browser-test.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML = path.join(DIST, 'md-flashcards.html');
const HARNESS = path.join(__dirname, 'browser-harness.js');
const TEST_PAGE = path.join(DIST, '_test.html');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function fail(msg) {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(HTML)) fail('产物不存在，先运行 python build.py: ' + HTML);

const html = fs.readFileSync(HTML, 'utf8');

/* ---------------- 静态检查 ---------------- */
const REQUIRED_IDS = [
  'view-home', 'view-review', 'view-browse', 'statBar', 'heroEmpty', 'homeBody',
  'deckList', 'rvCard', 'rvTitle', 'rvAnswer', 'rvQuestion', 'rateRow', 'rvSummary',
  'cardList', 'modal', 'modalBox', 'toast', 'fileInput', 'jsonInput', 'searchInput',
  'setMode', 'setGran', 'setQstyle', 'rvBar', 'rvDeck', 'rvProg', 'btnShow',
  'zipInput', 'dirInput', 'cardsJsonInput',
  'view-quick', 'view-manage', 'quickDeck', 'quickMeta', 'quickBody', 'quickOutline',
  'quickSearch', 'manageList', 'manageMeta',
  'view-settings', 'setTheme', 'setLang', 'aiActive', 'aiProviderList', 'aboutVersion',
  'tabbar', 'view-stats', 'statsChips', 'statsHeat', 'statsBars', 'statsMonth', 'statsY', 'statsM', 'statsD',
];
const missingIds = REQUIRED_IDS.filter((id) => !new RegExp('id="' + id + '"').test(html));
if (missingIds.length) fail('缺少必需元素 id: ' + missingIds.join(', '));

// 最后一个 <script> 块 = core + app（前面是内置题库数据块）
const lastOpen = html.lastIndexOf('<script>');
const lastClose = html.lastIndexOf('</script>');
if (lastOpen < 0 || lastClose < lastOpen) fail('找不到内联脚本');
const appScript = html.slice(lastOpen + '<script>'.length, lastClose);
if (/<\/script/i.test(appScript)) fail('应用脚本里出现 </script>');
try {
  // 只编译不执行，用于捕获语法错误
  new Function(appScript);
} catch (e) {
  fail('内联脚本语法错误: ' + e.message);
}

const externalRefs = (html.match(/<(?:script|link)[^>]*(?:src|href)="(https?:)?\/\//g) || []);
if (externalRefs.length) fail('产物包含外部资源依赖: ' + externalRefs.join(', '));

console.log('ok   静态检查（id 完整、脚本语法、无外链依赖）');
console.log('ok   产物大小 ' + (html.length / 1024).toFixed(1) + ' KB');

/* ---------------- 生成测试页 ---------------- */
const harness = fs.readFileSync(HARNESS, 'utf8');
const testPage = html.replace('</body>', '<script>\n' + harness + '\n</script>\n</body>');
fs.writeFileSync(TEST_PAGE, testPage, 'utf8');

/* ---------------- headless 运行 ---------------- */
const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!edge) {
  console.log('skip 未找到 Edge/Chrome，跳过头less 冒烟测试');
  process.exit(0);
}

const profileDir = path.join(DIST, '_edge-profile');
const fileUrl = 'file:///' + TEST_PAGE.replace(/\\/g, '/');
const args = [
  '--headless=new',
  '--disable-gpu',
  '--disable-crash-reporter',
  '--disable-breakpad',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--allow-file-access-from-files',
  '--user-data-dir=' + profileDir,
  '--virtual-time-budget=20000',
  '--dump-dom',
  fileUrl,
];

let dom = '';
const dumpPath = path.join(DIST, '_dump.html');
const errPath = path.join(DIST, '_dump.err.txt');
try {
  // 说明：沙箱环境禁止用管道捕获子进程输出，这里直接把 stdout/stderr 写文件
  const fdOut = fs.openSync(dumpPath, 'w');
  const fdErr = fs.openSync(errPath, 'w');
  try {
    execFileSync(edge, args, { stdio: ['ignore', fdOut, fdErr], timeout: 120000 });
  } finally {
    fs.closeSync(fdOut);
    fs.closeSync(fdErr);
  }
  dom = fs.existsSync(dumpPath) ? fs.readFileSync(dumpPath, 'utf8') : '';
} catch (e) {
  dom = fs.existsSync(dumpPath) ? fs.readFileSync(dumpPath, 'utf8') : '';
  if (!dom) fail('headless 运行失败: ' + (e.message || e));
}

const m = /data-test-results="([^"]*)"/.exec(dom);
if (!m) {
  fs.writeFileSync(path.join(DIST, '_test-dom.html'), dom, 'utf8');
  fail('测试结果未写入（页面可能启动失败），已保存 DOM 到 dist/_test-dom.html');
}

const results = m[1].split(' || ');
const fails = results.filter((r) => r.indexOf('FAIL') === 0);
results.forEach((r) => console.log((r.indexOf('FAIL') === 0 ? 'FAIL ' : 'ok   ') + r.replace(/^(ok|FAIL)\s+/, '')));

try { fs.unlinkSync(TEST_PAGE); } catch (e) { /* ignore */ }
try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }

if (fails.length) {
  console.log('\n' + fails.length + ' / ' + results.length + ' 项失败');
  process.exit(1);
}
console.log('\n浏览器冒烟测试通过：' + results.length + ' 项');
