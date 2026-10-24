# Markdown 笔记 → 安卓闪卡：工具链调研

> 调研时间：2026-10-21（Asia/Shanghai）。价格/版本/star 数均为当日抓取，会过期。
> 目标场景：一堆很长的计算机类 `.md` 笔记 → 拆成卡片 → 安卓手机上每天随机/间隔复习。
> 本轮已验证的链接均来自 GitHub REST API、raw README（经 gh-proxy 镜像取回）、官方手册页面；未验证的单独标注「未核实」。

---

## 0. 先说三个会改变方案的关键事实

1. **AnkiDroid 不能直接导入 `.md` 或 `.csv`。** 官方手册 [AnkiDroid User Manual § Importing](https://docs.ankidroid.org/manual.html#importing) 原文：只能直接导入 `.apkg`；"AnkiDroid can't directly import text files. If you wish to do that, you'll need to do that with the desktop program." 所以任何「CSV 路线」都必须先过桌面版 Anki。
2. **Mochitto/Markdown2Anki 生成的 `.apkg` 只是"笔记类型模板"，不是成品卡组**；卡片本体输出为两个 CSV（`basic_anki_cards.csv` / `clozed_anki_cards.csv`）。想上手机，必须先用桌面 Anki 导入 CSV，再同步/导出。
3. **据官方手册，Anki 本体（桌面 / AnkiDroid）没有内置 Markdown 渲染**（在 Anki 手册的编辑/导入章节里未见 Markdown 相关选项；未逐版本核实）。要让卡片里显示 md，只能靠「笔记类型模板 + 客户端 JS」或转换时先转成 HTML（第三方插件/脚本）。见第 4 节。

> 结论：对安卓端最省事的是**直接产出 `.apkg` 的转换器**（mdankideck / md2apkg），把 apkg 传到手机导入即可，全程不需要桌面 Anki、不需要 AnkiWeb。

---

## 1. Mochitto/Markdown2Anki（CLI，Python）

- 仓库：<https://github.com/Mochitto/Markdown2Anki>
- 安装：`python -m pip install Markdown2Anki`，命令为 `md2anki`
- 维护状态：最近提交 **2025-03-23**（GitHub API `pushed_at`），128 star、24 个 open issue；PyPI 镜像索引里最新版本 **0.2.0**（官方 PyPI 页未直连核实发布日期）
- 协议：**GPL-3.0**（README 写明；`pyproject.toml` classify 为 GPLv3；GitHub API 的 license 字段为 null，属检测问题）
- 运行环境：`requires-python = ">=3.10"`（`pyproject.toml` 实测）
- 能力：Markdown→Anki、Pygments 代码高亮、cloze、图片自动拷到 Anki media 目录、Obsidian `[[笔记]]` / `![[图片]]` 链接、可切换主题；自带笔记类型（纯 HTML+CSS+JS，不依赖插件）

### 1.1 md 侧语法约定（README 原文核实）

- **卡片分隔**：三个及以上连字符 `---`。注意 `***` **不能**作为分隔符（作者故意这样设计，方便卡片内用 `*` 画分隔线）。
- **Tab 标签**：`## <flags> [<标签名>]`，flags 取 `F`(正面)/`B`(背面)/`L`(左栏)/`R`(右栏)/`-`(翻面时移除正面 tab)/`+`(用背面 tab 顶替被移除的正面 tab)；默认 `FL`。标签内不支持 md 格式。
- **cloze**：Anki 原生语法 `{{c1::答案}}` / `{{c1::答案::提示}}`，代码块里也能用。
- **图片**：`![[图片名.png]]`（Obsidian 风格）或标准 md 图片；在 `md2anki.config.ini` 里把 `images out-folder` 指向 Anki media 目录即可自动导入。
- **注释**：每张卡片开头、所有 tab 标签之前的文字视为注释（可留可删）。
- **错误处理**：格式错误会写进 `Bad_cards.md`，修好后 `md2anki -bf` 直接以该文件为输入重跑。

### 1.2 产出与"进 AnkiDroid"的真实路径

README 明确：程序输出 `basic_anki_cards.csv`、`clozed_anki_cards.csv`，以及一个 `markdown2anki.apkg`（**笔记类型模板**，双击导入 Anki 后会生成一个带模板示例卡的牌组）。

因此完整链路是：

1. `md2anki` 产出 CSV + 笔记类型 apkg
2. 桌面 Anki 双击 `markdown2anki.apkg` 导入笔记类型
3. 桌面 Anki 菜单 `File → Import`（官方手册 [Importing](https://docs.ankiweb.net/manual/importing/intro)：File 菜单 → "Import"）选 CSV：分隔符选 **Comma**、选对应 note type 与牌组、**勾选允许 HTML**（否则代码高亮/样式全丢）
4. 桌面 Anki 同步 AnkiWeb → 手机 AnkiDroid 点同步按钮
   （或桌面 `File → Export` 导 deck apkg，拷到手机导入）

⚠️ 坑：直接把这套 CSV 导入手机是行不通的（见第 0 节）；README 提到的 tab 热键 bug、`Couldn't find any element using the query` 报错、交互式首次配置（询问程序文件夹路径）都要有心理准备。命令行具体传入文件参数的方式 README 未写明（`md2anki -h` 可看），**未核实**。

**评价**：语法最"重"（自带 tab 布局），适合愿意按它的规矩重写笔记、且手边有桌面 Anki 的人；不适合"一堆现成笔记一次性转过去"。

---

## 2. `md2anki` 主题下的项目

先更正前提：**`repos.ecosyste.ms/topics/md2anki` 目前是空的**。2026-10-21 抓 `https://repos.ecosyste.ms/api/v1/topics/md2anki` 返回 `repositories_count: 0`。所以改用 GitHub 搜索 `md2anki`（25 个结果）来挑，下面两个是实测可用性最好的。

### 2.1 lukesmurray/markdown-anki-decks（推荐，目录级转换）

- 仓库：<https://github.com/lukesmurray/markdown-anki-decks>｜PyPI 包 `markdown-anki-decks`，命令 `mdankideck`
- 维护：最近提交 **2023-07-20**，144 star；PyPI 镜像索引最新 **1.1.1**；协议 **MIT**
- 输入格式（README 原文核实）：

  ```markdown
  # 牌组标题（h1 = deck 名）

  ## 问题（h2 = 卡片正面）

  h2 与下一个 h2 之间的所有 markdown = 卡片背面。

  ## 第二个问题

  答案内容。
  ```

- 命令（README 原文）：

  ```bash
  python -m pip install markdown-anki-decks

  # 把 input/ 下所有 md 转成 output/ 下每文件一个 .apkg
  mdankideck input output

  # 指定子牌组前缀（md:: 开头）
  mdankideck input output --prefix "md::"

  # （可选）转换完直接通过 AnkiConnect 推进桌面 Anki，需 --sync
  mdankideck input output --sync --delete
  ```

- 其它：`--cloze` 支持 `{{c1::...}}`；图片/音频必须与 md 同目录且文件名唯一；用 genanki 生成 apkg；**用"问题文本"做卡片唯一标识，README 声称重复导入不会产生重复卡**。
- **可用性**：最贴合"一堆 md 文件 → 一批 apkg → 手机导入"，且转换不需要桌面 Anki。代价：每张卡是"标题当问题、正文当答案"，长笔记要么一个 h2 一张大卡，要么重写成 Q/A 式标题。
- 风险：2023 年后没更新，Python 3.12/3.13 下是否兼容**未核实**（README 只说需 Python ≥3.7）。

### 2.2 Steve2955/md2apkg（单文件转换，语法最轻）

- 仓库：<https://github.com/Steve2955/md2apkg>｜npm 包 `md2apkg`
- 维护：最近提交 **2022-03-18**，24 star；协议 **GPL-3.0**
- 规则：**每个标题生成一张卡**，标题=正面，标题后的正文=背面；不需要任何自定义标记（自称 "without any weird custom syntax"）
- 命令（README 原文）：

  ```bash
  npm install -g md2apkg
  md2apkg -o deck.apkg notes.md
  md2apkg -o deck.apkg -i notes.md --deck-name "计网" --ignore-latex-dollar-syntax
  ```

- 可选标记：`<!-- md2apkg ignore-card -->` 跳过某标题；`<!-- md2apkg split -->`（可简写 `%`）把标题后一段正文也放到正面；`<!-- md2apkg tags tagA tagB -->` 打标签；支持选择题（`<!-- md2apkg type multiple-choice -->`）、LaTeX 转换、highlight.js 代码高亮。
- **可用性**：最省事，一个文件一条命令。缺点是**一次只处理一个 md**，文件多要自己写循环。
- 风险：2022 年后停更；Node 新版下是否顺利安装**未核实**。

### 2.3 其它同名项目（都不推荐，仅备案）

- `nx10/md2anki`（Python，2020 后停更，12 star）、`JoshuaGross/md2anki`（2017，MIT）、`echocamel/md2anki`（中文项目，导入目录到 Anki，2020 后停更）、`wxxedu/md2anki`（已 archived）、`liamvdv/md2anki`（已 archived）——均无近期维护，除非你想自己改代码。

---

## 3. Obsidian 系插件：`Q::A` / `#flashcards` 与同步到 AnkiDroid

### 3.1 obsidian-spaced-repetition（`#flashcards` 和 `Q::A` 的真正出处）

- 仓库：<https://github.com/st3v3nmw/obsidian-spaced-repetition>
- 维护：最近提交 **2026-10-05**，2590 star，356 open issue；协议 **MIT**；文档 <https://stephenmwangi.com/obsidian-spaced-repetition/>
- 笔记内标记（README 原文核实）：
  - 打 `#flashcards` 标签 = 这一篇成为牌组；`#flashcards/子牌组` 分子牌组
  - 单行：`问题::答案`；双向：`问题:::答案`
  - 多行：问题 / `?` / 答案；双向多行用 `??`
  - cloze：`==高亮==`、`**加粗**`、`{{花括号}}`，或自定义 cloze 规则
  - 复习可加 `#review` 标签整篇回顾
- **注意**：这套语法**不是** Obsidian_to_Anki 的默认语法，两者常被混为一谈。
- 复习方式：**在 Obsidian 内复习**（FSRS/SM-2），完全不进 Anki。安卓装 Obsidian 手机版、把 vault 放本地（或 Syncthing），即可每天复习 —— 这是"完全不折腾 Anki"的路线。

### 3.2 Obsidian_to_Anki（把 Obsidian md 推进 Anki，再同步手机）

- 仓库：<https://github.com/ObsidianToAnki/Obsidian_to_Anki>（原作者 Pseudonium，已迁到组织）
- 维护：最近提交 **2024-06-16**，2047 star，277 open issue（维护放缓）；协议 **GPL-3.0**；也有独立 Python 脚本 `obsidian_to_anki.py`
- 卡片语法：**正则自定义**。README 给的可选风格示例（全部为 `custom syntax`，Wiki 明确"所有自定义语法默认关闭，需在配置里启用"）：
  - RemNote 单行：`这是用法::Remnote 单行风格`
  - `Q: 问题` / `A: 答案`
  - Neuracache：一行 `#flashcard`，其后几行作为背面
  - `---` 分隔的 ruled 风格、markdown 表格风格、`{cloze paragraph}` 段落 cloze
- 同步到 AnkiDroid 的完整路径（这是它唯一能上手机的方式）：
  1. 桌面 Anki 装 **AnkiConnect**（项目页 <https://git.foosoft.net/alex/anki-connect>；AnkiWeb 安装代码未核实），配置 `webBindPort: 8765`、`webCorsOriginList` 含 `app://obsidian.md`（README 给的原样 JSON）
  2. Obsidian 装插件 → 扫描 vault → 通过 AnkiConnect 把卡片写进桌面 Anki 的当前 profile/牌组
  3. 桌面 Anki 同步 **AnkiWeb**
  4. 手机 AnkiDroid 点右上同步按钮拉取（AnkiDroid 无法装 AnkiConnect，插件只在桌面端工作）
- 优点：已有一堆 Obsidian 笔记时增量更新最舒服（改 md 再跑一次会更新已有卡片、保留调度）。缺点：必须有一台跑桌面 Anki 的电脑。

---

## 4. Anki 的 Markdown 渲染插件：到底有没有

| 项目 | 是否真实存在 | 作用 | 维护 | 协议 | 移动端 |
|---|---|---|---|---|---|
| [Anki Markdown](https://github.com/terkelg/anki-markdown)（AnkiWeb addon `1172202975`） | ✅ 存在 | 新增 "Anki Markdown" 笔记类型，Front/Back 里直接写 md，渲染时转 HTML，Shiki 300+ 语言高亮、表格、callout、MathJax | 最近提交 **2026-09-29**，49 star | **MIT** | README 声称支持 desktop / **AnkiDroid** / AnkiMobile / AnkiWeb；语言包会同步到 `collection.media`。**我未在真机验证 → 未核实** |
| [Anki-KaTeX-Markdown](https://github.com/Jwrede/Anki-KaTeX-Markdown)（AnkiWeb addon `1087328706`） | ✅ 存在 | 新增支持 Markdown + KaTeX 的 Basic/Cloze 笔记类型（markdown-it） | 最近提交 **2026-10-18**，86 star | **未标注**（GitHub license 字段 null，README 无协议段） | README 称"任何设备，只要能联网"（渲染依赖在线资源），离线可用性**未核实** |
| [AnkiXMarkdownXMindMap](https://github.com/zjulyx/AnkiXMarkdownXMindMap) | ✅ 存在 | 写 md 并预览为思维导图的 Anki 插件（不是通用 md 渲染） | 最近提交 **2024-04-20**，27 star | **MIT** | 插件仅桌面 |
| `AnkiXMarkdown`（精确同名） | ❌ 未找到 | — | — | — | — |
| "Markdown notes"（精确同名 Anki 插件） | ❓ **未核实** | 可能是指上面的 "Anki Markdown" | — | — | — |

结论：
- Anki **本体没有 md 渲染开关**；所谓"Anki 支持 Markdown"都是"笔记类型 + 客户端 JS/预渲染 HTML"。
- 插件只能在桌面安装（AnkiDroid 无插件体系）。**能不能在手机显示 md，取决于渲染脚本是否随卡片模板/`collection.media` 同步到手机**，这一点只有 Anki Markdown 明确声称做到了；Anki-KaTeX-Markdown 那句"要联网"暗示渲染依赖外部 CDN，在飞机上/弱网可能失效（未核实）。
- 更稳的做法仍是：**转换阶段就把 md 转成 HTML 存进卡片**（mdankideck / md2apkg / md2anki 都是这样），手机端零插件。

---

## 5. 开源 Web / PWA："上传 md → 自动拆卡片 → 随机复习"

现状：**没有找到同时满足"单文件 HTML / 免服务器 + 导入 md 自动拆卡 + 间隔重复"三点的成熟开源项目。** 三者各有 2/3：

### 5.1 lucagrippa/md2anki（AI 自动拆卡，web，需服务器 + API key）

- 仓库：<https://github.com/lucagrippa/md2anki>｜在线 demo：<https://md2anki.vercel.app>
- 维护：最近提交 **2025-04-25**，92 star；协议 **GPL-3.0**
- 流程（README 原文）：上传 `.md` → 点 "Generate flashcards"（OpenAI GPT-4o-mini）→ 在线编辑卡片 → 下载 `.apkg` → 导入 Anki 学习
- 成本/依赖：自部署需 `OPENAI_API_KEY`（`.env.local`），Next.js + Vercel AI SDK；**必须有服务器（或 Vercel 账号）且按 token 付费**
- 适用：不想手工拆卡、愿意花钱；输入是"整篇 md"，输出直接是 apkg，对安卓最友好。中文长笔记的拆卡质量**未核实**。

### 5.2 protocedvill/markdown-to-flashcards（无 AI 规则拆卡，本地 Flask + Obsidian 插件两种形态）

- 仓库：<https://github.com/protocedvill/markdown-to-flashcards>
- 维护：最近提交 **2026-08-18**，1 star（很新）；协议 **MIT**
- 形态：Python 解析器 + 本地 Flask web app；另有 Obsidian 插件版（同解析器，端口到 TS，**无需服务器**）
- 命令（README 原文）：

  ```bash
  git clone https://github.com/protocedvill/markdown-to-flashcards.git
  cd markdown-to-flashcards
  pip install flask
  python3 server.py <notes.md | notes_folder>   # 然后浏览器开 http://127.0.0.1:5050
  ```

- 拆卡规则（无 AI，按结构模式匹配）：编号问答（`1. 问题` + 下一行答案）、嵌套 bullet、LMS 导出格式、带 `(x)` 答案的选择题、`**术语** 是……`、`术语: 定义`、`术语 - 定义`、裸问题。无法识别的自由散文会跳过。
- 短板：**不含间隔重复调度**（README 未提 SRS），且只能跑在电脑上/局域网，没做成 PWA；项目非常新，稳定性未验证。

### 5.3 G10nn1/SRSFlashCardMan.github.io（单文件 HTML + SRS，但不能导入 md）

- 仓库：<https://github.com/G10nn1/SRSFlashCardMan.github.io>
- 形态：**单文件 HTML**（vanilla JS + Tailwind + marked.js + IndexedDB），纯静态可 GitHub Pages，**无需服务器**
- 能力：SRS 间隔（1/3/7/16/35 天）、正反面均支持 md 渲染、统计面板、数据存浏览器本地
- 短板：**README 未提供"导入 md 自动拆卡"功能**（只能手输卡片）；0 star、最近提交 2026-01，属小众自用项目
- 顺便排除：`coalman/flashdown`（2013 年的 md flashcard web app，已 archived，别用）

> 如果坚持"纯网页 + 免服务器 + 自动拆卡"，现实解法是自己写个 100 行的单页应用（`FileReader` 读 md → 按 `##` 拆 → `localStorage` 存 → 简单 SRS），或接受 5.2 的本地服务器。没有现成轮子可直接抄（未核实到）。

---

## 6. 最省事落地路径（推荐）：mdankideck → `.apkg` → AnkiDroid 直接导入

**为什么是它**：全程只需要一台能跑 Python 的电脑 + 手机，**不需要桌面 Anki、不需要 AnkiWeb 账号、不需要联网插件**；AnkiDroid 原生支持 apkg 导入。

### 步骤 1：电脑上装转换器

```bash
# 需要 Python 3.8+（工具要求 ≥3.7）
python -m pip install --upgrade markdown-anki-decks
mdankideck --help   # 确认安装成功
```

### 步骤 2：把 md 改造成它的三段式（可用脚本半自动）

规则：`#` = 牌组名，`##` = 问题/知识点标题，`##` 之间正文 = 答案。

```markdown
# 计算机基础

## TCP 三次握手为什么是三次？

防止已失效的连接请求报文突然又传到服务端……
（这里可以放列表、表格、代码块）

## 进程和线程的区别

- 进程：资源分配单位
- 线程：CPU 调度单位
```

批量脚本：给每个文件补一个统一的 h1，并把 `###` 提升成 `##`（按需调整）：

```bash
mkdir -p notes_fixed
for f in notes/*.md; do
  b=$(basename "$f")
  { echo "# 计算机笔记"; echo; sed -E 's/^### /## /' "$f"; } > "notes_fixed/$b"
done
```

### 步骤 3：转换出 apkg

```bash
mkdir -p out
mdankideck notes_fixed out --prefix "md::"
ls out            # 每个 md 一个 .apkg
```

> 如果更习惯"一个标题一张卡、不加 h1/h2 规整"，可换 md2apkg：
>
> ```bash
> npm install -g md2apkg
> mkdir -p out
> for f in notes/*.md; do
>   md2apkg -o "out/$(basename "${f%.md}").apkg" "$f"
> done
> ```

### 步骤 4：把 apkg 传到手机

USB 拷贝、微信文件传输助手、网盘都行；放到手机 `Download/` 或 AnkiDroid 目录均可。

### 步骤 5：AnkiDroid 导入（菜单路径）

1. 打开 AnkiDroid → 牌组列表页
2. 右上角 **⋮（溢出菜单）→ Import / 导入**
   （老版本在 `+` 按钮菜单里也有导入入口；官方手册写法是 "From the main menu in the deck list, choose **Import**"）
3. 选中 apkg → **OK**
4. 也可跳过 App 内菜单：在文件管理器里直接点 `.apkg`，AnkiDroid 会接管并弹确认框

> 注意：文件名以 `.colpkg` 结尾的是**整库替换**；普通 `.apkg` 是**合并**（官方手册 [Importing](https://docs.ankidroid.org/manual.html#importing) 明确区分）。mdankideck 产出的是普通 apkg。

### 步骤 6：每天复习 + "随机"

- 每天打开 AnkiDroid，点牌组 → 按 Anki 调度（间隔重复）复习；这是默认行为，无需配置。
- 想要"随机顺序"：牌组 → 长按/进入 **Deck options（牌组选项）→ Display Order 里的 Review sort order 选 Random**（桌面版菜单名可查 [Anki 手册 Deck Options](https://docs.ankiweb.net/manual/deck-options)；AnkiDroid 里对应"牌组选项"的具体文案我未核实）。
- 想"今天就想乱序背全部"：牌组长按 → **Custom study / 自定义学习** → 选 cram/随机，做筛选牌组（AnkiDroid 支持，见手册 filtered decks 一节）。
- 每天新卡量：Deck options → New cards/day（默认 20，建议先调小，避免一堆长卡压垮）。

### 步骤 7：增量更新

改完 md 后重跑步骤 3，把新 apkg 再导入一次即可。mdankideck 用"问题文本"当唯一 ID，README 声称重复导入不产生重复卡（AnkiDroid 端实测**未核实**，建议第一次先拿 1 个文件试）。

---

## 7. 方案对比

| 方案 | 需要什么 | 拆卡方式 | 上安卓路径 | 适合谁 |
|---|---|---|---|---|
| **mdankideck（推荐）** | Python + 电脑 | h1/h2 结构化 | apkg 直接导入 AnkiDroid | 有大量现成 md，想一次搞定 |
| md2apkg | Node + 电脑 | 每个标题一张卡 | apkg 直接导入 | 单文件笔记、语法最轻 |
| Markdown2Anki | Python + 桌面 Anki | tab/`---` 手工排版 | CSV 进桌面 Anki → 同步 AnkiWeb | 愿意按它的规矩重写、要炫酷卡片 |
| Obsidian_to_Anki | 桌面 Anki + AnkiConnect + Obsidian | 正则自定义 | 桌面 Anki → AnkiWeb → AnkiDroid | 笔记本来就在 Obsidian，要增量更新 |
| obsidian-spaced-repetition | 只装 Obsidian（含安卓） | `Q::A` / `#flashcards` | 不进 Anki，手机 Obsidian 内复习 | 不想碰 Anki 的人 |
| lucagrippa/md2anki（web） | 服务器/Vercel + OpenAI key | AI 自动生成 | 下载 apkg → AnkiDroid | 不想手工拆卡、愿付费 |
| markdown-to-flashcards | 本地 Python 服务器 | 规则匹配自动拆 | 浏览器复习（无 Anki 导出） | 想在电脑上快速过一遍 |

---

## 8. 未核实 / 存疑清单（别当事实用）

- Markdown2Anki 的 PyPI 发布日期、命令行传参细节（README 只说首次运行有引导，`md2anki -h` 看参数）。
- Markdown2Anki / md2apkg 在最新 Python 3.13 / Node 22 下是否可直接跑通（均为停更项目）。
- Anki Markdown（terkelg）在 AnkiDroid 真机上的渲染效果、离线表现（README 声称支持，未实测）。
- Anki-KaTeX-Markdown 的许可证（仓库未标注）与离线可用性。
- AnkiDroid 当前版本（2.26 alpha / 2.25.3 稳定）的"牌组选项"里随机排序的实际文案与位置。
- mdankideck 重复导入在 AnkiDroid 端是否真的不产生重复卡（README 声称）。
- 是否存在"单文件 HTML + 上传 md 自动拆卡 + SRS"的成熟项目：本轮未找到，不排除有未被搜索到的项目。
- `repos.ecosyste.ms/topics/md2anki` 为 0 条是 2026-10-21 的结果，可能随后补录。
