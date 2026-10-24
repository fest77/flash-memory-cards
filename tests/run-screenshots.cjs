'use strict';
/**
 * 用 headless Edge 给构建产物截图（手机尺寸）
 * 用法: node test/run-screenshots.cjs
 * 产物: dist/shots/home.png / review.png / answer.png
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML = path.join(DIST, 'md-flashcards.html');
const HARNESS = path.join(__dirname, 'shot-harness.js');
const SHOTS = path.join(ROOT, 'docs', 'images');
const PROFILE = path.join(DIST, '_edge-profile-shot');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!edge) {
  console.log('skip 未找到 Edge/Chrome');
  process.exit(0);
}

const html = fs.readFileSync(HTML, 'utf8');
const harness = fs.readFileSync(HARNESS, 'utf8');
fs.mkdirSync(SHOTS, { recursive: true });

const shots = [
  { mode: 'home', file: 'home.png', width: 504, height: 1000 },
  { mode: 'review', file: 'review.png', width: 504, height: 940 },
  { mode: 'answer', file: 'answer.png', width: 504, height: 1180 },
  { mode: 'quick', file: 'quick.png', width: 504, height: 1100 },
  { mode: 'quicktoc', file: 'quick-toc.png', width: 504, height: 1100 },
];

shots.forEach(function (shot) {
  const page = html.replace(
    '</body>',
    '<script>window.__SHOT_MODE__ = ' + JSON.stringify(shot.mode) + ';</script>\n<script>\n' + harness + '\n</script>\n</body>'
  );
  const pagePath = path.join(DIST, '_shot-' + shot.mode + '.html');
  fs.writeFileSync(pagePath, page, 'utf8');
  const out = path.join(SHOTS, shot.file);
  const shotProfile = PROFILE + '-' + shot.mode + '-' + Date.now();
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--window-size=' + shot.width + ',' + shot.height,
    '--user-data-dir=' + shotProfile,
    '--virtual-time-budget=9000',
    '--screenshot=' + out,
    'file:///' + pagePath.replace(/\\/g, '/'),
  ];
  try {
    execFileSync(edge, args, { stdio: 'ignore', timeout: 120000 });
  } catch (e) {
    // 截图成功时进程也可能返回非 0，继续检查文件
  }
  if (!fs.existsSync(out) || fs.statSync(out).size < 1000) {
    console.log('FAIL ' + shot.mode + ' 截图未生成: ' + out);
    process.exitCode = 1;
  } else {
    console.log('ok   ' + shot.mode + ' -> ' + path.relative(ROOT, out) + ' (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');
  }
  try { fs.unlinkSync(pagePath); } catch (e) { /* ignore */ }
  try { fs.rmSync(shotProfile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
});
