# Developer Guide

> For maintainers: architecture, module responsibilities, data model, build & test, extension points, pitfalls.
> User-facing docs: [`README.md`](README.md).

---

## 1. What it is

A **zero-backend, dependency-free, single-file** markdown flashcard app:

- Input: `.md` / `.txt` / `.zip`, or the bundled deck;
- Process: split into Q/A cards by heading / `Q:`/`A:` / bold questions; generate a question when the heading is not one;
- Output: random recall (3-way self-rating), "quick read" by chapter + question outline, deck management, JSON backup, settings (theme / language / about);
- Ship forms: one HTML (~180 KB, no bundled data) or an Android WebView APK.

**Non-goals**: accounts, cloud sync, SM-2/FSRS scheduling, any framework or CDN.

Hard constraint: **no rented/purchased server**. Everything must run locally in the browser / on device. LLM features are BYO-key or offline scripts only.

---

## 2. Repository layout

```
md-flashcards/
├── README.md                  # user docs
├── DEVELOPER.md               # this file
├── dist/md-flashcards.html    # build output (committed)
├── src/
│   ├── index.tpl.html         # page skeleton + 4 inline placeholders
│   ├── core.js                # pure functions: parsing/splitting/questions/render/zip
│   ├── app.js                 # UI, state, storage, review, quick, manage, AI
│   ├── styles.css             # dark mobile-first CSS
│   ├── bundled-decks.js       # bundled deck data (generated; NOT included in this repo — optional)
│   └── bundled-images.js      # bundled screenshots as WebP data URIs (generated; optional)
├── scripts/
│   ├── build.py               # inline → dist/md-flashcards.html
│   ├── ai_cards.py            # md → AI cards JSON (OpenAI-compatible / Ollama)
│   ├── build_interview_decks.py  # interview md → bundled-decks.js
│   └── build_interview_images.py # interview images/ → bundled-images.js
├── tests/
│   ├── core.test.cjs          # 58 unit tests (Node, no browser)
│   ├── browser-harness.js     # injected into the built page
│   ├── run-browser-test.cjs   # static checks + 121 headless-Edge assertions
│   ├── run-screenshots.cjs    # writes docs/images/*
│   ├── persist-test.cjs       # file:// persistence check
│   └── fixtures/notes.zip     # zip-parsing fixture
├── docs/
│   ├── images/                # screenshots used by README
│   └── research/              # comparable tools research
├── android/                   # WebView APK project (Gradle)
└── .github/workflows/build-apk.yml
```

---

## 3. Build pipeline

```
src/index.tpl.html
  ├── /*STYLES*/  ← src/styles.css
  ├── /*IMAGES*/  ← src/bundled-images.js  (window.MDReviewBundledImages = {deckName:{file:dataURI}})
  ├── /*BUNDLED*/ ← src/bundled-decks.js   (window.MDReviewBundledDecks = {...})
  ├── /*CORE*/    ← src/core.js            (window.MDReviewCore)
  └── /*APP*/     ← src/app.js             (window.MDReviewApp, test hook)

python scripts/build.py → dist/md-flashcards.html
```

`build.py` guards: all placeholders replaced, no `</script>` inside inlined code, no external resource references in the template.

**Bundled deck generation** (`scripts/build_interview_decks.py`): splits `**（N）question？**` style notes by chapter (`#`/`##`/`###`), keeps `path[]`, converts `![[...]]` images to `（配图 imgXXX）` text, emits 553 cards with a `version` string. The app seeds decks once per version.

**Bundled images** (`scripts/build_interview_images.py`): maps each bundled deck to its screenshot folder (`images/image上（第1-2章）` etc. by chapter key), compresses every referenced image to WebP (max side 900, quality 78, GIF first frame), and emits `window.MDReviewBundledImages = {deckName: {filename: dataURI}}`. At render time `renderAnswerHtml(text, deck)` replaces `（配图 imgXXX）` with `<img class="md-img" src="data:...">`; no state is written, so deck progress is untouched. The generated file is ~6 MB; the final HTML is ~7 MB.

**Android asset copy**: `android/app/build.gradle.kts` registers `copyWebAssets`, copying `../dist/md-flashcards.html` to `app/src/main/assets/index.html` before `preBuild`. So `scripts/build.py` must run first.

---

## 4. Runtime architecture

```
┌───────────────────────────────────────────────────────────┐
│ View layer (app.js)                                        │
│ view-home / view-review / view-browse / view-quick /       │
│ view-manage + modals (import queue, AI, rename, export)    │
├───────────────────────────────────────────────────────────┤
│ Application logic                                          │
│ import queue / splitter calls / review state machine /     │
│ quick outline & TOC / manage actions / AI calls / backup   │
├───────────────────────────────────────────────────────────┤
│ Domain layer: core.js (pure, DOM-free, Node-testable)      │
│ parse → split → question text → card ids → render → unzip  │
├───────────────────────────────────────────────────────────┤
│ Storage: Store (app.js IIFE)                               │
│ IndexedDB('md-review'/'kv'/'state') → localStorage fallback│
└───────────────────────────────────────────────────────────┘
```

State is a **single object**; every change calls `scheduleSave()` (250 ms debounce, whole JSON). `pagehide` / `visibilitychange` flush immediately.

Data flows:

- **Import**: file/zip → text → `Core.buildDeck(name, text, {mode, maxCardLen, qstyle})` → cards → merge/replace into `state.decks` → render home.
- **Review**: `collectReviewItems → shuffle → reveal → rate(ok/fuzzy/bad) → update state.stats → phase-1 bad/fuzzy enter round 2 → finishReview`.
- **Quick**: `openQuick(deckId) → filter by q → group by path[0] → render chapter groups + chapter→question TOC → jump sets chapter + highlight`.
- **Bundled**: `boot → seedBundledDecks(false) → if settings.bundledVersion !== data.version, merge/replace 3 decks → save version`.

---

## 5. Data model

```js
state = {
  version: 1,
  decks: [{
    id: 'd<fnv32>',            // builtin: 'd'+hash('bundled|name')
    name: 'display name',      // renameable
    title: 'subtitle',
    createdAt: 1730000000000,
    mode: 'auto|h1|h2|h3|qa|hr|para|ai',
    qstyle: 'prompt|title|cloze',
    raw: 'original md (may be empty for bundled/AI)',
    source: 'file name',
    bundled: false,
    cards: [{
      id: 'c<fnv32(title|question|answer)>', // stable key for progress
      title: 'headline',
      question: 'optional prompt',
      answer: 'markdown answer',
      path: ['Chapter 1', '1.1 …', '1.1.2 …']   // used by quick grouping
    }]
  }],
  stats: { [cardId]: { s: 'new|learning|known', n, ok, bad, last } },
  daily: { 'YYYY-MM-DD': count },
  settings: {
    mode, gran: 'fine|mid|coarse', qstyle,
    filter: 'all|todo',
    theme: 'dark|light',        // v1.6
    lang: 'zh-Hans|zh-Hant|en', // v1.6
    bundledVersion: '2026-10-23.1',
    ai: {                       // v1.7: multi-provider
      activeId,
      providers: [{ id, name, base, key, models[], model, enabled,
                    protocol: 'openai'|'anthropic', preset }],
      removed: [presetId]       // deleted presets are not re-seeded
    }
  }
}
```

Notes:

- Card id is a content hash: re-importing the same note keeps progress; editing a card keeps its id.
- Collisions get a `-2` suffix.
- `state.decks` order is home order; rename only changes `name`.

---

## 6. Module index

### core.js (`window.MDReviewCore`)

| Group | Functions | Notes |
|---|---|---|
| utils | `hash32`, `escapeHtml`, `normalize`, `stripFrontMatter`, `cleanInline`, `truncate` | |
| structure | `codeMask`, `collectHeadings`, `sectionsAt`, `chooseLevel` | code fences excluded from heading detection |
| QA | `extractQA` | `Q:`/`A:`, `问：/答：`, `**题目：**`, `Q1:` |
| paragraphs | `chunkParagraphs` | merge paragraphs up to `maxLen` |
| split | `cardsFromLevel`, `cardsFromHr`, `cardsFromParagraphs`, `finalizeCards` | |
| questions | `isQuestionLike`, `pickTemplate`, `makeCloze`, `makeQuestion` | prompt / title / cloze styles |
| main | `parseMarkdown(text, opts)` → `{title, cards, modeUsed}` | opts: `mode/maxCardLen/useQA/qstyle` |
| render | `renderMarkdown`, `renderInline`, `plainText` | escape → inline rules; code/table/list/quote |
| zip | `unzipFiles(buffer)`, `unzipTextFiles(buffer)` | EOCD + central dir; stored/deflate; UTF-8→GBK name fallback |
| deck | `buildDeck(name, text, opts)` | |

### app.js (`window.MDReviewApp` for tests)

| Area | Functions |
|---|---|
| storage | `Store.load/save` (IDB→localStorage fallback), `scheduleSave`/`flushSave` |
| state | `emptyState`/`normalizeState`, `findDeck`/`statusOf`/`knownOf`/`bumpDaily` |
| import | `openImportModal`/`addQueueFiles`/`addQueueZip`/`doImportQueue`/`importText`/`importCardsJson` |
| bundled | `seedBundledDecks(force)`/`restoreBundled`/`buildBundledDeck` |
| review | `collectReviewItems`/`startReview`/`nextCard`/`renderCard`/`showAnswer`/`rate`/`finishReview` |
| quick | `openQuick`/`renderQuick` (with TOC)/`toggleQuickToc`/`quickJump`/`toggleQuickAll` |
| browse | `openBrowse`/`renderBrowse`/`openCardModal`/`saveCard`/`deleteCard` |
| manage | `openManage`/`renderManage`/`openRenameModal`/`doRename`/`resetDeckProgress` |
| backup | `backupJson` (via `stripAiKeys` — backups never contain API keys or images)/`showExport`/`downloadFile` (AndroidSaver bridge first)/`importBackup` |
| user images | `IMG_URLS` (basename → objectURL)/`loadStoredImages` (kv keys `img/NAME` + `imgIndex`)/`storeImage`/`importImageFiles`/`importImageEntries` (zip)/`resolveImgSrc` (post-render `<img>` swap; missing → `.img-missing` chip)/`rememberImage` (test hook) |
| AI | `aiChat` (openai + native anthropic `/v1/messages` protocols, fetch + timeout + error mapping)/`startAiRefine` (batched, question-only)/`parseAiQuestions` |
| ai providers | `AI_PRESETS` (DeepSeek/Z.ai/Kimi/Bailian/ChatGPT/Claude, added on demand — not auto-seeded)/`normalizeAi` (migration)/`renderAiProviders`/`onProviderField`/`openAddProviderModal`/`addPreset`/`addCustomProvider`/`deleteProvider`/`testProviderModal` |
| ai quick | `openAiQuick`/`pickAiQuick` — home modal to switch provider · model without opening settings |
| settings | `openSettings`/`onThemeChange`/`applyTheme` (body.light + meta theme-color) |
| navigation | bottom `#tabbar` (home/manage/stats/settings, `data-act="tab"`); `showView` syncs highlight (review/quick/browse → home tab); top-right entries removed in 1.8 |
| stats | `renderStats`/`renderHeat` (26-week GitHub-style grid, `state.daily` per-day counts, auto-scroll to latest)/`renderBars` (last 7 days)/`applyStatsMode` (`settings.statsView` = heat|bars); daily retention 370 days |
| obsidian images | `Core.convertWikiImages` (`![[path/img.png|w]]` → `![](path/img.png)`, applied in renderMarkdown + renderInline); `resolveImgSrc` also wired into the single-line question branch (`renderInline`) and the review title (titles containing image syntax render as imgs via `.rv-title img` CSS) |
| android schemes | `shouldOverrideUrlLoading` routes non-http(s) schemes (mailto:/tel:) to system apps via ACTION_VIEW |
| stats extras | touch/mouse tooltip `#statTip` via delegated pointerover/pointerdown on `[data-tip]`; Y/M/D selectors (from 2020) set `statsAnchor` — both charts re-window around it (heat 26wk ends at anchor + `.sel` outline, bars = 7 days ending at anchor); `renderStatsCharts`/`applyStatsMode` re-scroll (rAF) since hidden charts can't scroll; `stats-today` resets |
| i18n | `I18N` dict (zh-Hans/zh-Hant/en)/`t`/`tf`/`applyI18nStatic` (`data-i18n`, `data-i18n-ph`, `data-i18n-aria`, `data-i18n-title`) |
| events | `bindEvents` (single `data-act` delegate) + `onAction` switch |

### scripts

- `ai_cards.py` — `split_sections` / `chunk_long` / `refine_batch` / `call_api` (urllib, no deps). Emits `{app:'md-review-ai',decks:[...]}`, importable via "导入 AI 卡片".
- `build_interview_decks.py` — `split_file` (heading stack + bold-question detection + code mask + image replacement) → `bundled-decks.js`.

### android

- `MainActivity.java` — WebView + a self-intercepted `https://appassets.androidplatform.net/` origin (assets served via `shouldInterceptRequest`, **no androidx dependency**), `onShowFileChooser` (multi-select md/zip), `AndroidSaver` bridge (backup → Downloads), back-button routing into the web app.
- `app/src/main/res/values/{strings,themes}.xml`, PNG launcher icons in `mipmap-*`.

---

## 7. Design decisions

| Decision | Why |
|---|---|
| Inline everything, no bundler | Users just open a file on a phone; offline by default |
| Content-hash card ids | Re-import/rename keeps mastery progress |
| Escape then render markdown | Third-party md is untrusted; prevents XSS |
| Split logic in pure functions | Node unit tests without a DOM |
| Bundled deck + version string | Zero setup; controllable updates; restorable after delete |
| zip unzipped in browser | Phone pickers often single-select; zip is a reliable bulk channel |
| AI rewrites question only | Never let the model alter factual answers |
| BYO-Key, no server | Product constraint; PC script covers CORS-blocked APIs |
| Intercepted https origin in APK | `file://` origins may disable IndexedDB/localStorage; also keeps the APK dependency-free |

---

## 8. Extension guide

**Add a view**
1. Add `<main id="view-xxx" class="view">` in `index.tpl.html`;
2. `showView('xxx')` switches (history handled automatically);
3. Add an entry in `onAction` (e.g. `case 'open-xxx'`).

**Change splitting** — only `core.js` (`parseMarkdown` / `cardsFrom*`), plus `tests/core.test.cjs`. Do not touch DOM there.

**Change bundled deck** — edit `scripts/build_interview_decks.py` → run it → bump `BUNDLE_VERSION` (drives re-seeding) → `python scripts/build.py`.

**Add a card field** — write it in `finalizeCards`, default it in `normalizeState` (old data compatibility), update `backupJson` if needed.

**Change AI protocol** — `aiChat` is the single egress point.

**Add UI strings** — never hard-code user-facing text in `app.js`/`index.tpl.html`; add a key to all three `I18N` dicts (`zh-Hans` is the fallback), use `t(key)` in JS and `data-i18n` / `data-i18n-ph` / `data-i18n-aria` / `data-i18n-title` in the template.

**Add a theme** — themes are CSS-variable sets; `:root` holds dark values, `body.light` overrides them. Wire the select in `view-settings` + `applyTheme`.

**Caution**: state changes must stay backward-compatible via `normalizeState`, otherwise existing users lose data.

---

## 9. Tests

```bash
node tests/core.test.cjs            # 58 tests, Node 18+ (DecompressionStream)
node tests/run-browser-test.cjs     # static checks + 121 headless Edge assertions
node tests/run-screenshots.cjs      # docs/images screenshots
node tests/persist-test.cjs         # file:// persistence
```

How the E2E works: inject `tests/browser-harness.js` into the built page → headless Edge `--dump-dom` → parse `body[data-test-results]`. Static checks: required element ids, app-script syntax (`new Function` compiles only), no external refs, bundled script doesn't break inlining.

⚠️ Headless Edge under a restricted sandbox needs full access (IPC is blocked otherwise), and **do not** capture child-process output through pipes — redirect stdout to files instead.

---

## 10. Known pitfalls

1. **`</script>` must not appear** in inlined data (interview text could contain it). `build.py` validates.
2. **file:// storage** works in most Chromium builds; a few disable it → use a fixed http origin.
3. **localStorage fallback is ~5 MB**; the bundled JSON is ~700 KB. Prefer IndexedDB.
4. **`DecompressionStream('deflate-raw')`** needs a recent Chromium; older browsers reject zip import.
5. **CORS** blocks most LLM APIs from the browser; this is expected — use the script or local Ollama.
6. **Long answers** (up to ~10k chars, "project walkthrough") are scrollable; self-rating is better than verbatim recall.
7. **Images**: the bundled decks' 199 screenshots are embedded as WebP data URIs (~6 MB, longest side 900px); user-imported notes still cannot resolve local image paths.
8. **Android build** needs `dist/md-flashcards.html` first; the Gradle task fails if missing.

---

## 11. Version history

| Version | Changes |
|---|---|
| 1.0 | single-file splitting, random review, backup |
| 1.1 | mobile import queue / zip, question styles, BYO-key AI, AI card import |
| 1.2 | 3 bundled interview decks (553 cards), quick-read view, deck management |
| 1.3 | chapter→question TOC with jump & highlight; developer docs |
| 1.4 | repo renamed to English paths; Android WebView APK project + GitHub Actions |
| 1.5 | bundled 199 screenshots embedded as WebP (~7 MB single file); image placeholder rendering |
| 1.6 | repo build ships without bundled deck data (gitignored, regenerable); settings view (theme dark/light, zh-Hans/zh-Hant/en i18n, about page); dist reduced to a single ~180 KB file |
| 1.7 | multi-provider AI settings (presets added on demand from an "add provider" sheet + custom, enable/disable, multi-model, per-provider test), home quick model-switcher modal, native Anthropic protocol support, API keys excluded from backups |
| 1.7.1 | preset model lists refreshed to each vendor's current APIs (2026-10): DeepSeek v4.1-Flash-1017 (`deepseek-flash`), Z.ai GLM-5.3, Kimi K3.1, Bailian Qwen3.8, OpenAI GPT-6.1, Claude 5.5; untouched legacy presets auto-upgraded on load (keyed/edited ones untouched) |
| 1.7.2 | image import: file picker accepts images (+zip/folder), images stored in IndexedDB (kv `img/*`), rendered into cards by filename via `resolveImgSrc`; `safeUrl` now allows relative paths; Android chooser MIME adds image types; ready-to-install APK shipped at repo root |
| 1.7.3 | zip detected by content (PK magic), not extension — renamed zips (e.g. WeChat `.apk.1`) import fine; the generic file button also routes zips to the unzipper (pass `ZIP_ACCEPT_RE` to `Core.unzipFiles` — its default filter only takes md/txt); about page feedback email |
| 1.8.0 | bottom tab navigation (home/notes/stats/settings, top-right entries removed); new Stats view "闪记日志": GitHub-style heatmap (default) toggleable with 7-day bar chart; chart preference persisted |
| 1.8.1 | stats: tap/hover tooltip (date + count) on heatmap cells, bars and month cells; Y/M/D picker (years from 2020) switching heatmap to a calendar-month heat view with selected-day highlight; back-to-today reset |
| 1.8.2 | date search reworked after feedback: heatmap keeps its form (window shifts to selected date, cell outlined) instead of turning into a calendar; bars now follow the search too (7 days ending at the date); scroll-into-view fix for charts rendered while hidden |
| 1.8.3 | Obsidian `![[...]]` image embeds render in cards (title/question/answer); mailto: links in About open the system email app instead of ERR_UNKNOWN_URL_SCHEME |
| 1.8.4 | review fixes: Q/A markers now require a separator (QPS/API no longer misparsed), pre-marker prose kept as an overview card, lookbehind regex removed (old-WebView white screen), save failures surfaced via throttled toast, restore keeps local AI/theme/lang, deleting decks/cards prunes stats, GBK fallback for imported md, quick-read groups by owning section title (card.title; `path` only holds ancestors), fixed committed debug.keystore (覆盖安装-safe), external links open outside the app, allowBackup=false, unused androidx.webkit removed, test artifacts moved to tmpdir |
| 1.8.5 | second-round review fixes: quick-read grouping actually works (chapter = card's owning section title, `path` only holds ancestors), overview cards titled `小节 · 概览`/`文档标题 · 概览` instead of 知识点 N, `flushSave` also surfaces resolved-false, AI undo reachable from home after closing the modal (`aiRun.lastRefine`), latent `kidQA[kq]` crash fixed, `Q1、`/`Q1.` numbering recognized again (digit + 顿号/句点), parent-section preface kept when an oversized section is split into children |
| 1.8.6 | third-round review fixes: new `chapter` field (owning section) threaded through parsing/storage/normalizeState — quick-read groups by `chapterOf` reading `chapter` only; off-by-one in parent-preface capture (`sec.start` is already the line after the heading); AI undo reports failure honestly when the deck changed; zh-Hant/en dictionaries got the missing undo strings |
| 1.8.7 | fourth-round review fixes: chunked-card branches (paragraph chunks inside an oversized section, soleTitle chunks) also write `chapter`; qa-mode overview card shares the questions' (empty) chapter instead of a docTitle group; old-data fallback comment corrected — `path` only holds ancestors, old decks keep coarse grouping until re-imported |
| 1.10.0 | spaced review: `Core.schedule` (Leitner 3-box 1/3/7d) + `isDue` (boxless = due today); stats gain `box/ivl/dueAt`; home due-chip; review setup modal (20/50/all, weak-first = has-errors-or-box-1, per-chapter via `chapterOf` full path); session persisted in `state.reviewSession` (queue/round2/current/undo as id lists, flushed on rate — 250ms debounce is not enough) and resumed via `#resumeBar`; undo restores stat + queue from pre-rating snapshot; quick-read groups by full `path+chapter` path (same-name sections under different parents no longer merge); qa-mode cards carry heading-chain `path`; About feedback email moved below repo links |
| 1.10.1 | review-path fixes: todo filter now keeps due cards (`isTodoStat`: known-but-due counts; chip label 待复习, same counting); multi-deck 复习全部 opens the setup modal (count + scope, no chapter dim); weak is a strict filter (`isWeakStat`: has errors, or reviewed and still box-1 — fresh cards excluded; label 只看薄弱卡); starting a new review with an unfinished session asks first (`confirm.newSession`), resume still one-tap; empty sessions pruned on render/start; harness stubs window.confirm for headless |
| 1.11.0 | data safety: `Core.zipStore` (store-mode zip writer, CRC32, roundtrips with unzipFiles/Python); full backup = zip with backup.json+images/, deck export json gains `kind:'deck'`; import parses zip/legacy json → preview modal → overwrite (double confirm) / merge (`mergeBackupState`: id-match, conflict → name+suffix copy, stats only fill missing); failures never touch local state; images: content-digest dedup + auto-rename (`img-2.png`) with same-batch reference rewrite (`IMG_RENAMES`); unreferenced-image cleanup (settings + auto after deck delete, `Store.rawDelete`); deck delete keeps stats of cards shared with other decks; backup reminder bar (lastChangeAt/lastBackupAt/7d, dismissible) + File System Access folder one-tap zip; Android `saveBinary`/`shareFile` bridge |
