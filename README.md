# MD Flashcards · 笔记闪卡

> 把一份很长的 md 笔记拆成一张张卡片，手机上随机抽背 / 分类速记。
> **纯本地、零安装、零后端、不需要服务器。**
> 本版本（Gitee）**不含内置题库**：导入自己的 md / zip 即可使用；题库生成脚本保留在 `scripts/`，用自己的资料可自行生成。

![首页](docs/images/home.png)

---

## 1. 它解决什么问题

| 现成方案 | 卡在哪 |
|---|---|
| AnkiDroid | 只认 `.apkg`，`.md` 必须先转换 |
| a-flash-deck | 只渲染卡内 Markdown，不吃 `.md` 文件 |
| NeuraCache / Obsidian 插件 | 能导入 md，但要装 App/插件、要按它的语法改笔记，多数是闭源 |
| Logseq / SiYuan | 开源，但 md 要"进库"、制卡要手工/换格式 |

这个工具只做一件事：**把一份很长的 md 笔记，拆成一张张卡，随机抽给你背**。不建库、不联网、不改你的原文件。

---

## 2. 三种用起来的方式

### 方式 0：本地验收（推荐 / 排查加载问题）

应用是单文件网页（本版本不含题库）：

| 文件 | 体积 | 说明 |
|---|---|---|
| `dist/md-flashcards.html` | ~230 KB | 唯一的构建产物，功能完整 |

**如果双击/预览打不开**，多半是预览器对中文路径有限制，改用本地 HTTP 服务：

```bash
# 在项目根目录
python -m http.server 8788 --directory dist
```

浏览器访问 **http://127.0.0.1:8788/** （单文件约 230 KB，Chrome/Edge 打开秒加载）。

### 方式 A：直接开网页（最简单）

1. 把 [`dist/md-flashcards.html`](dist/md-flashcards.html) 传到手机：微信/QQ 文件传输助手、数据线、网盘都行。
2. 用 **Chrome / Edge / 夸克** 打开（文件管理器里长按 → 打开方式 → 浏览器；如果看到源码，说明用错了打开方式）。
3. 点「📥 导入 md / zip（批量）」→ 选择文件 → 「导入全部」。
4. 浏览器菜单 → **添加到主屏幕**，以后像 App 一样打开。

> **打不开/白屏**：先换本地 HTTP 服务方式（方式 0）；文件很小（约 230 KB），基本不可能是体积问题。

> **图片**：导入时把 md 引用的图片一起选中即可（也支持 zip 打包、电脑端整文件夹）。支持标准 Markdown `![](images/a.png)` 和 **Obsidian 嵌入 `![[images/a.png]]`**（可带 `|宽度` 后缀），按**文件名**匹配引用（取 `a.png`），同名覆盖，只存本机；「备份全部」不含图片，换机后重新导入一次即可。
>
> **手机端只能单选文件？** 这是部分系统文件选择器（如 ColorOS）的限制，不是网页坏了：
> - 在导入弹层里**分几次**点「选择文件」，每次加一个，最后一起「导入全部」；
> - 或者把 md 和图片**在电脑上压成一个 zip**，手机端选这个 zip，网页在本地解压后批量导入。
>
> 数据存在浏览器本地（IndexedDB，失败时退化为 localStorage）。**清理浏览器数据会清掉卡片和进度**，记得用「备份全部」定期导出 json。

### 方式 B：手机访问电脑

```bash
# 项目根目录
python -m http.server 8000
```

手机连同一个 Wi-Fi，打开 `http://<电脑IP>:8000/dist/md-flashcards.html`。

### 方式 C：装 APK（Android）

项目自带 WebView 壳（`android/`），打包后就是一个真正的 App：可离线、能调系统文件选择器、备份直接写进「下载」目录。

**最简单：仓库根目录就有现成的 APK，直接下载安装**（debug 签名，安装时允许「未知来源」）：

- GitHub：`https://raw.githubusercontent.com/fest77/flash-memory-cards/main/MDFlashCards-v1.8.5.apk`
- Gitee：`https://gitee.com/festeel/flash-memory-cards/raw/main/MDFlashCards-v1.8.5.apk`

自己打包的其他方式：

- 有 Android Studio：打开 `android/` 目录，等 Gradle 同步完，`Build → Build APK(s)`；
- 没有 Android Studio：推到 GitHub 后由 Actions 自动构建（见 [§9](#9-打包成-apk)），在 Actions 页面下载 artifact；
- 或用任意机器（JDK 17 + Android SDK 34）执行：

```bash
python scripts/build.py            # 先把网页内联成 dist/md-flashcards.html
cd android && gradle assembleDebug # 产物：app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. 它是怎么拆卡的

先按标题切段，再决定「题面怎么问」——两步都可以调。

### 3.1 拆分方式（切几段）

| 模式 | 规则 |
|---|---|
| **自动（推荐）** | 按标题层级选最合适的一层：`##` 优先；标题少就退到 `###`；超长小节自动再降一层或按段落切；只有一个标题时整篇当一张卡 |
| 按二级标题 `##` | 每个 `##` 小节 = 一张卡 |
| 按三级标题 `###` | 每个 `###` 小节 = 一张卡 |
| 按问答 `Q:/A:` | `Q: ...` + `A: ...` 拆成一张卡，支持 `问：/答：`、`**题目：**`、`Q1:` 等写法 |
| 按分隔线 `---` | 每条分隔线之间 = 一张卡（第一行当题面） |
| 按段落 | 没有标题的纯文本笔记，按段落合并成 ~800 字一张卡 |

### 3.2 提问风格（题面怎么问）

| 风格 | 效果 |
|---|---|
| **提问式（推荐）** | 标题不是疑问句时按内容套模板，例如「三次握手」→「不看答案，说说「三次握手」的核心内容？」；含列表 →「包含哪几个要点？」；含对比表 →「关键差异是什么？」 |
| 标题式 | 标题当题面，不额外生成问题 |
| 挖空式 | 把答案里的**加粗词 / 行内代码**挖成横线，题面变成填空题；挖不出来退回提问式 |

规则细节：

- 标题本身已是疑问句（含 `？`、为什么/如何/区别/原理…）时，不再重复生成问题。
- 卡片粒度可调：**细 ≤800 字 / 中 ≤1600 字 / 粗 ≤3000 字**。
- **代码块里的 `##` 不会被误判成标题**；YAML frontmatter 会被跳过。
- 卡片 id 由「标题+题面+答案」内容哈希生成：**重新导入同一份笔记，已掌握进度会保留**。
- 本版本不含内置题库与配图；`（配图 imgXXX.png）` 占位符的渲染逻辑保留，如自行生成题库配图可复用（见 `scripts/build_interview_images.py`）。

### 3.3 让大模型来提问（可选，不需要服务器）

| 方式 | 怎么用 | 成本 |
|---|---|---|
| **A. 电脑脚本 + 任意 OpenAI 兼容 API（推荐）** | `python scripts/ai_cards.py --input D:/notes --out ai-cards.json --base ... --model ...`，传到手机后点「导入 AI 卡片」 | 云端 API 按 token 计费；**Ollama 本地模型免费** |
| **B. 网页里直接调 API** | 首页「AI 提炼设置」填地址/模型/key → 笔记卡片点「AI 提炼」 | 同上；浏览器直连常被 **CORS** 拦 |
| **C. 什么都不用** | 用上面的「提问式 / 挖空式」模板 | 免费、离线 |

**关于 CORS**：网页是纯前端，请求直接从手机发给所填 API。很多厂商（DeepSeek 等）不返回 CORS 头，浏览器会拒绝；这时用方式 A 的脚本即可（脚本在电脑跑，不受 CORS 限制）。本机 **Ollama** 也可给网页用：启动前设 `OLLAMA_ORIGINS=*`。

网页 AI 只改**题面**，不改答案，避免模型篡改知识内容；失败会保留原题面并提示。

---

## 4. 复习方式

- **随机洗牌**：每一轮打乱全部所选卡片（或多本笔记混合随机）。
- 先看题面回忆 → 点卡片 / 「显示答案」/ 空格。
- 自评：**😵 忘了 / 🤔 模糊 / 😎 记住了**（手机可左右滑动评价；键盘 `1 / 2 / 3`、`空格`、`Esc`）。
- 忘了/模糊的卡在本轮结束后自动进 **第 2 轮**。
- 「只看没掌握」过滤：只抽还没记住的卡。
- 浏览/编辑：搜索卡片、改标题/题面/答案、删卡、重置进度。

| 复习（未揭晓） | 揭晓答案 |
|---|---|
| ![复习](docs/images/review.png) | ![答案](docs/images/answer.png) |

---

## 4.5 分类速记（按章节看完整问答）

不是考试，而是**按大纲读**：首页或管理页点「分类速记」→

- 顶部章节大纲（第 1 章 / 第 2 章 …），点一下只看该章；
- 右上角 **☷** 打开**题目目录**：两级「章 → 题」，一题一行，点哪题直接跳到那道题的完整问答（跳过去会高亮），长笔记不用翻；
- 按章节分组，**题目 + 完整答案直接展开**；
- 每组可折叠，右上角 ⇕ 一键展开/收起全部；
- 搜索框按题目或答案过滤，目录也会跟着筛。

![分类速记](docs/images/quick-toc.png)

---

## 4.6 笔记管理

点底部导航 **📚 笔记管理** 进入，每个笔记都支持：

- **分类速记**、**随机复习**
- 重命名（只改显示名，进度不变）、重置进度、导出、删除。

---

## 4.7 统计（闪记日志）

点底部导航 **📊 统计** 进入：

- 顶部三个小指标：**今日复习 / 累计复习 / 连续天数**；
- 中间的图默认是 **热力图**（GitHub 风格：一格一天，颜色越深复习越多，最近半年），可一键切换为 **条形图**（最近 7 天，每天一根柱）；
- **手指点 / 鼠标悬停**任意格子或柱子，会弹出「日期 + 当日复习次数」气泡；
- **年 / 月 / 日 选择器**（年份从 2020 起）：选定日期后，热力图与条形图窗口平移到以该日期为终点——热力图形态不变、选中格蓝框描边并滚到视野中央，条形图显示以该日结尾的 7 天；点「回到今天」恢复默认；
- 图表偏好会记住，下次打开还是你选的样子；数据来自每天的复习记录，只存在本机。

## 4.8 设置（主题 / 语言 / 关于）

点底部导航 **⚙️ 设置** 进入：

- **通用设置**
  - **主题**：深色（默认）/ 浅色；
  - **语言**：简体中文 / 繁體中文 / English，全界面即时切换（含提示语和确认框）。
- **AI 供应商**：支持同时配置多个供应商，随时启用 / 停用、切换「当前使用」。
  - 预置 **DeepSeek、Z.ai、Kimi、Bailian（阿里云百炼）、ChatGPT、Claude** 六家，在「＋ 添加供应商」里按需加入（地址和常用模型已预填，填上自己的 Key 即可用），不用的一直不占地方；
  - 也可添加**自定义供应商**（任何 OpenAI 兼容接口，如本机 Ollama）；Claude 走 Anthropic 原生协议，应用自动适配；
  - 每个供应商可维护**多个模型**（逗号分隔），并单独选择「当前模型」；
  - 每张卡有独立的「测试连接」。

**主页快捷切换**：首页的「🤖 AI 提炼 · 当前供应商 ▾」按钮点开即弹窗选择「供应商 · 模型」组合，不用进设置页；未配置时点它会引导去设置。

- **关于**：应用图标与名称（MD闪记卡 / MD FlashCards）、版本号、作者、反馈邮箱（fest1024@163.com）、Gitee / GitHub 仓库地址。

主题与语言保存在本机设置里，重启后保持。

> **隐私**：API Key 只保存在本机浏览器（IndexedDB），请求从本机直接发往对应厂商，不经任何服务器、不上传云端；「备份全部」导出的文件**不包含 Key**，换机后需重新填写。

---

## 5. 数据与备份

- 全部数据只在本机浏览器：`IndexedDB`（不可用时 `localStorage`）。
- 「备份全部」导出 json（含卡片 + 复习进度；**不含 API Key、不含图片**），到新手机「恢复备份」后重新导入图片即可。
- 在 APK 里，备份会通过原生桥直接写进系统「下载/MD Flashcards」目录。
- 删除笔记/卡片只影响本机，**不会改你的原始 .md 文件**。
- AI 的 API Key 也只存本机，不上传。

---

## 6. 已知限制

- **没有 SM-2 / FSRS 记忆曲线**：这是"随机抽背 / 主动回忆"工具，不做间隔排期。要记忆曲线请用 AnkiDroid（配 mdankideck 转 apkg）或 Obsidian + Spaced Repetition。
- 单文件、单机；不做云同步（用 json 备份换机）。
- 没有标题、没有分段、一整段几千字的笔记只能按段落切，卡片质量一般 → 建议补 `##` 小标题。
- 图片按文件名匹配、只存本机且不进备份（见导入章节）；引用了图片但没导入图片时，卡面显示「图片未导入」占位。
- 网页 AI 受浏览器 CORS 限制，不保证每个厂商都能直连（脚本方式不受限）。
- 老安卓浏览器（不支持 IndexedDB / DecompressionStream）会退化：前者用 localStorage，后者 zip 导入不可用（可改选 md 文件）。

---

## 7. 项目结构

```
md-flashcards/
├── README.md                 # 用户文档（本文件）
├── DEVELOPER.md              # 开发者文档：架构 / 数据模型 / 扩展指南
├── dist/
│   └── md-flashcards.html    # 构建产物（单文件，~180 KB）
├── src/
│   ├── index.tpl.html        # 页面骨架 + 五个内联占位符
│   ├── core.js               # 纯函数：拆卡 / 提问 / Markdown 渲染 / zip 解包
│   ├── app.js               # 界面、存储、复习、速记、管理、AI、设置、多语言
│   └── styles.css            # 主题样式（深色默认 + 浅色，CSS 变量驱动）
├── scripts/
│   ├── build.py              # 内联构建 → dist/md-flashcards.html
│   ├── ai_cards.py           # 电脑端 md → AI 卡片 JSON
│   ├── build_interview_decks.py   # 题库 md → bundled-decks.js（可选，本版未含数据）
│   └── build_interview_images.py  # 题库配图 → bundled-images.js（可选，本版未含数据）
├── tests/
│   ├── core.test.cjs         # 32 项单元测试
│   ├── run-browser-test.cjs  # 71 项 headless Edge 端到端
│   ├── run-screenshots.cjs   # 生成 docs/images 截图
│   └── fixtures/             # 测试用 zip
├── docs/
│   ├── images/               # 文档截图
│   └── research/             # 同类方案调研
├── android/                  # WebView APK 工程（Gradle）
└── .github/workflows/build-apk.yml
```

```bash
python scripts/build.py             # 构建单文件
node tests/core.test.cjs            # 单元测试
node tests/run-browser-test.cjs     # 浏览器冒烟测试（需要 Edge/Chrome）
node tests/run-screenshots.cjs      # 重新截图
python scripts/ai_cards.py --input <目录> --dry-run   # 只看切分，不调 API
```

> 架构、模块职责、数据模型与扩展指南见 **[DEVELOPER.md](DEVELOPER.md)**。

---

## 8. 和现成方案怎么选

| 你的情况 | 建议 |
|---|---|
| 只想把 md 拆开、随机背，不想装东西 | **本工具**（单文件网页 / APK） |
| 想要记忆曲线、长期复习 | **AnkiDroid** + [`mdankideck`](https://github.com/lukesmurray/markdown-anki-decks) 一次性转 `.apkg`（见 [docs/research/toolchain.md](docs/research/toolchain.md)） |
| 笔记本来就在 Obsidian，要卡片 + 间隔重复 | Obsidian 安卓 + [Spaced Repetition 插件](https://github.com/st3v3nmw/obsidian-spaced-repetition) |
| 想要完全开源、中文界面、笔记即 md | [Logseq](https://github.com/logseq/logseq)（`#card`）或 [SiYuan](https://github.com/siyuan-note/siyuan)（内置闪卡 + FSRS） |
| 想要零折腾但接受闭源 | [NeuraCache](https://neuracache.com/markdown-flashcards)（App 内 Import Markdown File） |

更完整的调研见 [docs/research/apps.md](docs/research/apps.md)。

---

## 9. 打包成 APK

`android/` 是一个最小 **WebView 壳**（纯 Java，零第三方依赖）：

- 通过手写 `shouldInterceptRequest` 以 `https://appassets.androidplatform.net/` 提供网页（不用 androidx），让 IndexedDB / localStorage 有稳定 origin；
- 实现 `onShowFileChooser`，手机端可一次选多个 md / zip；
- `AndroidSaver` 原生桥：备份 JSON 直接写进「下载/MD Flashcards」；
- **固定调试签名**：`android/debug.keystore` 随仓库管理（debug 密钥按 Android 惯例非机密），任何机器构建的 APK 签名一致，升级直接覆盖安装；对外分发请注意这是 debug 包
- 返回键优先关弹层 / 回上一页，再退出。

### 9.1 GitHub Actions（无需本地 SDK）

1. `git init && git add . && git commit -m "init"`
2. 在 GitHub 新建仓库并 push；
3. Actions 跑 **Build Android APK**，完成后在 run 页面下载 `md-flashcards-debug-apk`；
4. 手机安装 apk（debug 签名，安装时允许「未知来源」）。

也可以手动触发：仓库 Actions → Build Android APK → Run workflow。

### 9.2 本地构建

需要 JDK 17 + Android SDK（platform 34 / build-tools 34）：

```bash
python scripts/build.py
cd android
gradle assembleDebug
# 产物 android/app/build/outputs/apk/debug/app-debug.apk
```

发布版需自备签名：

```bash
keytool -genkeypair -keystore release.jks -alias mdflashcards -keyalg RSA -keysize 2048 -validity 10000
# 在 android/app/build.gradle.kts 里加 signingConfigs，然后 gradle assembleRelease
```

---

## 10. 内置题库（本版本未包含）

本仓库版本为了精简与版权考虑，**不包含任何内置题库数据**，打开即是空应用，导入自己的 md / zip 即可。

应用本身完整保留了题库装载能力：只要把题库数据放回 `src/bundled-decks.js`（与可选的 `src/bundled-images.js`）再重新构建，即可恢复「打开自带题库」的行为。生成脚本也一并保留：

```bash
export INTERVIEW_DIR="D:/path/to/interview-md"   # 含题库 md 与 images/ 配图目录
python scripts/build_interview_decks.py      # md → src/bundled-decks.js
python scripts/build_interview_images.py     # images/ → src/bundled-images.js（WebP）
python scripts/build.py                      # 内联 → dist/md-flashcards.html
```

题库 md 的预期排版：`# 第X章` 章节标题，题目用 `**（1）问题？**` 加粗疑问句标注，配图放 `images/` 对应子目录；具体规则见 `scripts/build_interview_decks.py` 头部注释。

---

## 11. 上传 GitHub 前

- 目录与文件名已全部改为英文（内容仍可为中文）；
- `.gitignore` 已排除 Android 构建产物、APK、签名文件、Python 缓存、测试临时文件；
- `dist/md-flashcards.html` 是需要提交的（GitHub Pages 可直接用它）；
- 想用 GitHub Pages：Settings → Pages → Source 选 `main` / `root`，访问 `https://<user>.github.io/<repo>/dist/md-flashcards.html`；
- 许可证按需添加（MIT / Apache-2.0 等）。

---

## 12. 版本历史

| 版本 | 变更 |
|---|---|
| 1.5 | 首个发布版：拆卡 / 随机复习 / 分类速记 / 管理 / 备份 / AI 提炼（BYO-key）/ Android 壳 |
| 1.6 | 设置视图（右上角 ⚙）：浅色主题（默认深色）、简繁英三语切换、关于页；dist 精简为单文件 |
| 1.7 | AI 多供应商管理（预置 DeepSeek/Z.ai/Kimi/Bailian/ChatGPT/Claude 按需添加 + 自定义，启停/多模型/测试连接），主页模型快捷切换弹窗，Claude 原生协议适配，备份文件不再包含 API Key |
| 1.7.2 | 导入支持图片：md+图片多选 / zip 含图 / 文件夹，图片存本机并按文件名渲染进卡面；Android 选择器放行图片 |
| 1.7.3 | zip 按内容识别（PK 魔数），改过名的 zip 也能导；「选择文件」按钮也能收 zip；关于页加反馈邮箱 |
| 1.8 | 底部导航（主页 / 笔记管理 / 统计 / 设置，移除右上角入口）；新增「统计 · 闪记日志」：GitHub 风格热力图（默认）+ 最近 7 天条形图可切换 |
| 1.8.3 | 支持 Obsidian `![[图片]]` 嵌入语法（含 `|宽度` 后缀）；卡面标题/题面/答案中的图片都能解析显示；Android 壳拦截 mailto: 等外部协议转交系统应用（修复点邮箱报 ERR_UNKNOWN_URL_SCHEME） |
| 1.8.4 | 审查修复：Q/A 识别要求分隔符（QPS/API 等不再被误拆）、Q/A 前导正文保留为概述卡、移除旧 WebView 白屏的后行断言正则、保存失败明确提示、备份恢复保留 AI 配置与主题语言、删除笔记清理进度、GBK 编码回退、固定 APK 签名（可覆盖安装）、外链转系统浏览器 |
| 1.8.5 | 二轮复核修复：快速阅读分组、概述卡命名（小节 · 概览）、flushSave 失败也提示、AI 提炼撤销入口移到首页（关窗后仍可撤销）、修复 kidQA 潜在崩溃、恢复识别 `Q1、`/`Q1.` 编号 |
| 1.8.6 | 三轮复核修复：新增 `chapter` 字段（所属小节）贯穿解析与存储，快速阅读分组不再把题面当章节（问答/段落模式统一归未分类）；父小节前言 off-by-one 修复（标题后无空行的单行前言不再丢失）；AI 撤销失败如实提示；繁英补齐撤销文案 |

