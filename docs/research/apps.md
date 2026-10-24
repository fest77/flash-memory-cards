# 安卓端「上传 .md → 拆知识点 → 随机复习」App 调研

> 调研时间：2026-10-21 ｜ 方法：GitHub API / 官方站点 / 官方文档页 / 社区帖逐个读取，链接均为当日可访问地址。
> 判定「真正满足三条」= ① 能直接把 `.md` 文件喂进去 ② 能自动或半自动拆成一张张卡 ③ 打开就能随机/间隔复习。只满足其中 1~2 条的一律放「部分满足」，不夸大。

## 结论速览

- **最省事（闭源可接受）**：NeuraCache —— 安卓 App 里直接「Import Markdown File」，靠 `::` 和 `- - -` 切卡，SM2 每日队列。
- **最平衡（笔记本来就是 md、想要真·间隔重复）**：Obsidian 安卓 + **Spaced Repetition**（MIT 插件），`#review` 标签把整篇笔记变成"笔记卡"，且自带「随机打开一篇待复习笔记」。
- **最彻底开源**：SiYuan 思源（内置闪卡 + FSRS）或 Logseq（块级 `#card`，新卡复习顺序本身就是随机的）。
- **真按 `##` 切卡的极简工具**：flashdown / Essentialist，但安卓 APK 要自己用 NDK 编。
- **AnkiDroid、a-flash-deck 都不吃 `.md`**：前者吃 `.apkg`，后者吃 `.apkg`/自有 JSON/CSV，必须中间转一道。

## 总览表（按"离需求距离"排序）

| App / 方案 | 平台 | 开源 + 协议 | 直接导入 .md？ | 怎么拆知识点 | 随机/间隔复习 | 安装难度 | 最近维护 | 链接 |
|---|---|---|---|---|---|---|---|---|
| **NeuraCache** | 安卓原生 + iOS | ❌ 闭源商业（免费档可用） | ✅ 选「Import Markdown File」直接选 .md | 单行 `问题 :: 答案 #flashcard`；多行 `问题 #flashcard` + 答案 + `- - -` 收尾 | ✅ SM2 + 每日 Today's Queue；随机顺序未核实 | ★ 应用商店装 | 2026（在读官网/商店页） | [neuracache.com](https://neuracache.com/markdown-flashcards) ｜ [Play 商店](https://play.google.com/store/apps/details?id=com.idearoots.neuracache) |
| **Obsidian + Spaced Repetition** | 安卓 + 桌面（Obsidian 闭源免费） | ✅ 插件 MIT（Obsidian 本体闭源） | ✅ vault 就是文件夹，.md 直接丢进去 | `问题::答案` 单行卡；`#flashcards/子牌组` 标签；`#review` 把整篇笔记当一张卡 | ✅ 间隔重复 + 「Open a random note for review」+ cram 复习整篇 | ★★ 装 App + 手动装插件 | 插件 2026-10 仍更新 | [插件文档](https://stephenmwangi.com/obsidian-spaced-repetition/) ｜ [GitHub](https://github.com/st3v3nmw/obsidian-spaced-repetition) |
| **SiYuan 思源笔记** | 安卓 APK/应用商店 + 桌面 + iOS | ✅ AGPL-3.0（46.8k★） | ⚠️ 可导入 .md，但落地存成 `.sy` JSON | 选中块 `Ctrl+Alt+F` 快速制卡；列表项/标题块/超级块制卡；可「整篇文档制卡」 | ✅ 内置闪卡 + FSRS；随机顺序需插件（社区有需求帖） | ★★ 装 APK + 学快捷键 | 2026-10 活跃（v3.8.8） | [b3log.org/siyuan](https://b3log.org/siyuan/) ｜ [GitHub](https://github.com/siyuan-note/siyuan) |
| **Logseq（+ 内置 Flashcards）** | 安卓（官方 APK）+ 桌面 + 网页 | ✅ AGPL-3.0（45.3k★） | ✅ 页面本身存成 .md，放进 graph 即被索引 | 块尾加 `#card`，子块=答案；`{{cloze}}` 挖空；`{{cards [[页面]]}}` 按页/标签成组 | ✅ SM-2；**新卡复习顺序本身是随机的**（社区 2023 有抱怨帖） | ★★ 装 APK + 建 graph + 塞文件 | 2026-10（2.0.2 带 android apk） | [GitHub](https://github.com/logseq/logseq) |
| **flashdown / Essentialist** | 桌面 GUI/终端；安卓需自行构建 | ✅ MIT | ✅ 直接读 .md | **`##` 标题=问题**，其后内容直到下一个 `##` = 答案 | ✅ SM-2；进度存隐藏 `.xxx.md.db`；随机开关未核实 | ★★★★ 安卓要 NDK + fyne 编 APK | 2025-08（v0.2.7） | [GitHub](https://github.com/lugu/flashdown) |
| **a-flash-deck** | 安卓原生 | ✅ GPL-3.0（49★） | ❌ 只有卡片内 Markdown 渲染 | 手动建卡；或脚本把 CSV/TSV/JSON 转成牌组 | ✅ FSRS 或 SM-2；主屏「随机卡片」快捷方式 | ★★ 装 APK（或商店） | 2026-10-21 刚发 v2.4.0 | [GitHub](https://github.com/rh-id/a-flash-deck) |
| **AnkiDroid** | 安卓原生 | ✅ GPL-3.0（12k★） | ❌ 只吃 `.apkg/.colpkg`（CSV 导入长期缺失，issue #13683） | 靠外部转换器（md2apkg、Markdown2Anki 等） | ✅ 间隔重复 + 随机顺序选项，业界最强 | ★★★ 要转换 + 调牌组 | 2026-10 活跃 | [GitHub](https://github.com/ankidroid/Anki-Android) ｜ [Play 商店](https://play.google.com/store/apps/details?id=com.ichi2.anki)（包名 com.ichi2.anki，F-Droid 亦有） |
| **MarkCards**（jmarkfen） | 安卓原生 | ❌ 无协议文件（0★） | ✅ 官方描述"make flashcards from markdown files" | 分隔规则**未核实** | 未知/未核实 | ★★★★ 无发布包，需自己编 | 2023-06 后停更 | [GitHub](https://github.com/jmarkfen/MarkCards) |

## 逐项说明

### 1. NeuraCache（最接近"零折腾"）
安卓 + iOS 原生 App，导入路径是商店版就直接有的：Sources → **Import Markdown File** → 选手机里的 `.md`。官方教程给出的切卡语法只有两种：单行卡 `最大速度 :: 30 mph #flashcard`，以及多行卡「问题行带 `#flashcard`，答案若干行，最后单独一行 `- - -`（或 `---`/`***`）收尾」，正文里其它内容会被忽略，所以一整个长笔记文件塞进去是可行的。复习侧是 SM2 + 每日 Today's Queue，免费档就能用（Pro $3.99/月 或 $35.99/年，主要卖优先级、图表、AI 等）；坑是闭源、不是"随机洗牌"而是按算法到期排队（是否有随机开关**未核实**），且免费档导入是否限量**未核实**。

### 2. Obsidian 安卓 + Spaced Repetition 插件（最平衡）
Obsidian 本体闭源但免费（Sync $4/月可选，商用许可"不是必须买"），安卓官方 App 与桌面共用同一套 vault——你的 `.md` 笔记放进文件夹就等于"上传"完了。插件 `st3v3nmw/obsidian-spaced-repetition`（MIT，2.59k★，2026-10 仍在更新）提供三个层次：行内 `问题::答案`、`#flashcards/科目` 标签做牌组、以及 `#review` 标签把**整篇笔记当成一张"笔记卡"**按 Easy/Good/Hard 复习。最贴需求的是它的 Notes 模式：设置里有「Open a random note for review」，配「复习完自动打开下一篇」，等于"打开就随机刷笔记"；想刷卡片还有「Cram flashcards in this note」强制过一遍整篇。坑：手机端要手动装插件（或从桌面同步 `.obsidian/plugins` 配置）；插件会把调度信息写成 `<!--SR:...-->` 注释**改动你的笔记文件**（md 预览里不可见）。

### 3. SiYuan 思源笔记（最彻底开源 + 中文生态）
完全开源 AGPL-3.0，安卓有官方 APK，内置闪卡用 FSRS 算法，官网把「间隔重复」列为原生功能。制卡不靠分隔符而靠"选块 + 快捷键"：`Ctrl+Alt+F` 快速制卡，`Alt+D` 做挖空，`Alt+0` 打开卡片浏览器，`Alt+F` 复习；还支持列表项制卡、标题块制卡、超级块制卡，以及**右键文档名 → 闪卡 → 快速制卡**（整篇文章变卡）。支撑它的 `siyuan-note/riff` 是独立 AGPL 的间隔重复引擎。坑：数据存成 `.sy` JSON，`.md` 只是导入/导出格式，卡片信息不跟着 md 走；原生复习按到期/新卡顺序，社区有「希望闪卡能随机出现」的需求帖（→ 想要随机得装"渐进学习"等插件，具体插件可随机性**未核实**）。

### 4. Logseq（md 原生图 + 块级卡片）
Logseq 的页面本来就是 `.md` 文件，所以"上传 md"≈把文件放进 graph 的 pages 目录；卡片语法是块尾一个 `#card`，**子块就是答案**，`{{cloze 词}}` 做挖空，`{{cards [[某页面]]}}` 或 `{{cards #标签}}` 生成按主题过滤的牌组，复习用右上角学士帽图标或 `/cards`。随机性这里反而是自带的：社区帖明确抱怨"还没复习过的新卡是以随机顺序出现的"，说明复习顺序就是乱的；调度为 SM-2（块属性里写 `card-next-schedule` 等）。安卓有官方 APK（2.0.2 release 内 `Logseq-android-2.0.2.apk`，2026-10-07）。坑：安卓 11+ 往 graph 目录塞文件受分区存储限制（要靠文件管理器/同步工具，具体路径**未逐步核实**）；2.x DB 版正在替换存储层，老图仍是文件版；把长文按"块"加 `#card` 是手工活。

### 5. a-flash-deck（安卓原生、超活跃，但不吃 md）
GPL-3.0 的纯安卓闪卡 App，今天（2026-10-21）刚发 v2.4.0，加了 FSRS 调度、Anki `.apkg` 导入重写、通知栏直接评分。它**能渲染卡片里的 Markdown + LaTeX**，但输入通道只有三条：App 内手动建卡、Anki `.apkg`、以及自有 JSON 牌组（`Decks.json` 打包成 zip，官方还给了 `scripts/build_deck.py` 从 CSV/TSV 生成）。"随机复习"它做得很到位：可以生成主屏快捷方式「随机抽一张卡」，也有 SM-2/FSRS 定时通知。坑：`.md` 必须先脚本转 CSV/JSON，等于多写一步流水线；且这一步官方没现成 md 解析器。

### 6. AnkiDroid（间隔重复天花板，但 md 完全不认）
GPL-3.0、12k★、2026 年仍高频提交，是安卓上最成熟的 SRS。但它只导入 `.apkg/.colpkg`，CSV 导入在 issue #13683 里还是缺失状态——所以你的 `.md` 必须先转：`md2apkg`、`Markdown2Anki`、`Obsidian_to_Anki` 这类工具（各工具对 `Q:/A:`、`#flashcard`、Cloze 的支持不一，**未逐一核实**）。转完就同时拿到"随机顺序/自定义学习"和最强调度。坑：多一道转换、多一个工具链；长笔记切分规则完全取决于转换器，容易切错。

### 7. flashdown / Essentialist（最"纯"的 md 闪卡，安卓要自己编）
同一个 MIT 仓库出两个程序：**Essentialist**（Fyne 写的桌面 GUI，可交叉编译到安卓）和 **flashdown**（终端 CLI）。切卡规则是全场最直白的：每个 `##` 二级标题是问题，其下内容直到下一个 `##` 就是答案，进度存成隐藏文件 `.sample.md.db`，算法 SM-2。README 明确写"Android 支持未测试"，安卓包要装 NDK 后 `fyne package -os android` 再 `adb install`。坑：对普通用户门槛太高；文档/README 没提"随机复习"开关（**未核实**），但卡片少时按算法抽卡体验接近随机。

### 8. MarkCards（名字最对，但基本是弃坑学生项目）
GitHub 描述就是"An Android app that can make flashcards from markdown files"，2023-06 之后没有任何提交、0 star、**没有 LICENSE、没有 Release APK**，仓库里也没有导入语法文档（切分规则**未核实**）。要试只能自己 clone 后用 Android Studio 编译。结论：可以记一笔"存在过"，不建议依赖。

## 推荐排序

**① 零折腾（今天就想在手机上刷）→ NeuraCache**
商店装完，把 `.md` 丢进手机，Import Markdown File，按 `::` 和 `- - -` 分好卡即可。**坑**：闭源 + Pro 付费墙；随机性靠"每日队列"而非洗牌；长笔记需要你先按它的分隔符改一遍（否则整篇只会变成一张卡）。

**② 想要真·间隔重复、且笔记本来就是 md → Obsidian 安卓 + Spaced Repetition 插件**
`#review` 打一篇笔记就进"笔记卡"队列，"随机打开一篇待复习笔记"直接满足"打开就随机复习"；要卡就用 `::` 或 `#flashcards`。**坑**：手机端装插件要动手（或从桌面同步配置）；插件会往 md 里写 `<!--SR:...-->` 注释；Obsidian 本体闭源（数据是你的，程序不是开源的）。

**③ 想完全开源可控、还要中文界面 → SiYuan（首选）或 Logseq**
SiYuan：内置闪卡 + FSRS，官方中文，安卓 APK 直接装，制卡靠 `Ctrl+Alt+F` 选块；整篇文档也能一键变卡。**坑**：`.md` 导入后变 `.sy`，卡片与 md 脱钩；随机顺序要额外插件。
Logseq：md 文件就是数据本体，`#card` 语义干净，新卡本来就随机出；**坑**：安卓上把文件塞进 graph 目录略折腾，长笔记要按"块"手工打 `#card`。

**④ 想要最强调度/长期用 → AnkiDroid + 一次性 md→apkg 转换**
只在"你愿意写一次转换脚本、之后长期用 Anki 生态"时推荐。**坑**：md 直接导入是硬缺口，转换器质量参差。

**⑤ 折腾党 / 极客 → flashdown·Essentialist**
唯一"严格按 `##` 切分、MIT、纯文本"的方案，但安卓 APK 要自己编，作者都写明 Android 未测试。

## 踩坑清单（给用户的原话）

1. **"导入 md"有三种含义**：a) 文件即数据库（Logseq/Obsidian/flashdown）；b) 导入后转换（SiYuan→.sy、Anki→.apkg）；c) 只能粘贴纯文本（a-flash-deck 及多数轻量闪卡 App）。买/装之前先确认是哪一种。
2. **切分规则决定工作量**：`##` 标题最省心（flashdown）、`::`/`- - -` 次之（NeuraCache）、`#card` 块最灵活但最手工（Logseq）、`Ctrl+Alt+F` 选块最快（SiYuan）。若笔记是"一个大标题下几十条 bullet"，前两种都要先改格式。
3. **"随机" ≠ "间隔重复"**：Logseq 新卡随机、Obsidian 有"随机打开一篇笔记"、NeuraCache/Anki 是按算法排队。想要"每次打开随机抽卡"要专门确认有没有 shuffle/random 开关，本表里多处仍标"未核实"。
4. **安卓的文件访问**：Android 11+ 对 `Android/data` 有限制，把 md 塞进 App 私有目录往往要靠 App 自己的导入器或 Syncthing/文件管理器，这部分是本类方案最常翻车的地方。
5. **闭源/协议**：NeuraCache、Obsidian 本体、RemNote 等都是闭源；a-flash-deck/AnkiDroid/Logseq/SiYuan/flashdown 是真开源（GPL-3.0 / AGPL-3.0 / MIT）。GPL/AGPL 对"自己用"没有影响。

## 未核实 / 未纳入

- **RemNote、Mochi、Quizlet**：闭源商业，RemNote 虽有"导入 Markdown"的宣传但本次未抓到官方文档原文，故不列入推荐；Mochi 以桌面为主。
- **hashcards（eudoxia0）**：纯文本 SRS，Rust 实现、CLI/桌面向，安卓无 App，官方介绍见 [borretti.me 文章](https://borretti.me/article/hashcards-plain-text-spaced-repetition)。
- **各 App 的"随机洗牌开关"**：仅 Logseq（新卡随机，有社区帖佐证）与 Obsidian SR（"Open a random note for review"设置项）有文档级证据；NeuraCache、SiYuan 原生、flashdown 的随机行为标注为**未核实**。
- **Play 商店页**：本环境无法直接抓取 `play.google.com` 页面正文，商店链接取自各项目官网/官方 README 的跳转，应用是否存在以链接可达为准（NeuraCache、AnkiDroid 已在官网/README 中确认）。
- **MarkCards 的 md 切分语法**：仓库无文档、无 README 正文可读，未核实。

## 参考链接（均已实测可达）

- NeuraCache Markdown 教程：https://neuracache.com/markdown-flashcards ｜ 定价：https://neuracache.com/pricing
- Obsidian SR 插件文档：https://stephenmwangi.com/obsidian-spaced-repetition/ （Notes 页 / Reviewing 页）
- Obsidian 定价（免费/闭源/Sync）：https://obsidian.md/pricing
- Logseq 仓库（AGPL-3.0）：https://github.com/logseq/logseq ｜ 2.0.2 release 含 android apk
- Logseq 随机顺序社区帖：https://discuss.logseq.com/t/sort-flashcards-in-order-of-creation-date-while-reviewing-first-time/14060
- Logseq 卡片语法（第三方 skill 文档，交叉印证）：https://skillsmp.com/creators/inosven/logseq-skills/skills-logseq-flashcards
- SiYuan 官网/下载：https://b3log.org/siyuan/ ｜ 下载（安卓 APK）：https://b3log.org/siyuan/download.html ｜ riff 引擎：https://github.com/siyuan-note/riff
- SiYuan 闪卡快捷键实操文（2026-08）：https://www.cnblogs.com/andymashuo/p/22579600
- a-flash-deck：https://github.com/rh-id/a-flash-deck ｜ v2.4.0: https://github.com/rh-id/a-flash-deck/releases/tag/v2.4.0
- AnkiDroid：https://github.com/ankidroid/Anki-Android ｜ CSV 导入缺失 issue：https://github.com/ankidroid/Anki-Android/issues/13683
- flashdown/Essentialist：https://github.com/lugu/flashdown ｜ 包文档（含 README 全文）：https://pkg.go.dev/github.com/lugu/flashdown
- MarkCards：https://github.com/jmarkfen/MarkCards
- 其他插件：Retrieva（MIT，0★，2026-07 起）https://github.com/algiadev8/obsidian-retrieva ；Mnemoloop（MIT，FSRS，4★）https://github.com/Marco-Pozzecco/mnemoloop-plugin ；ebbinghaus-review（MIT，1★，只做整篇笔记复习排期）https://github.com/rheor108/ebbinghaus-review
