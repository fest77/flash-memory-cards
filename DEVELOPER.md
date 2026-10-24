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
│   ├── core.test.cjs          # 32 unit tests (Node, no browser)
│   ├── browser-harness.js     # injected into the built page
│   ├── run-browser-test.cjs   # static checks + 71 headless-Edge assertions
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
| backup | `backupJson` (via `stripAiKeys` — backups never contain API keys)/`showExport`/`downloadFile` (AndroidSaver bridge first)/`importBackup` |
| AI | `aiChat` (openai + native anthropic `/v1/messages` protocols, fetch + timeout + error mapping)/`startAiRefine` (batched, question-only)/`parseAiQuestions` |
| ai providers | `AI_PRESETS` (DeepSeek/Z.ai/Kimi/Bailian/ChatGPT/Claude)/`normalizeAi` (preset seeding + v1.6 single-config migration)/`renderAiProviders`/`onProviderField`/`addCustomProvider`/`deleteProvider`/`testProviderModal` |
| settings | `openSettings`/`onThemeChange`/`applyTheme` (body.light + meta theme-color) |
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
node tests/core.test.cjs            # 32 assertions, Node 18+ (DecompressionStream)
node tests/run-browser-test.cjs     # static checks + 71 headless Edge assertions
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
| 1.7 | multi-provider AI settings (6 presets + custom, enable/disable, multi-model, per-provider test), native Anthropic protocol support, API keys excluded from backups |
