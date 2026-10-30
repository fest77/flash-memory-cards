# Developer Guide

> For maintainers: architecture, module responsibilities, data model, build & test, extension points, pitfalls.
> User-facing docs: [`README.md`](README.md).

---

## 1. What it is

A **zero-backend, dependency-free, single-file** markdown flashcard app:

- Input: `.md` / `.txt` / `.zip`, or the bundled deck;
- Process: split into Q/A cards by heading / `Q:`/`A:` / bold questions; generate a question when the heading is not one;
- Output: random recall (3-way self-rating), "quick read" by chapter + question outline, deck management, JSON backup, settings (theme / language / about);
- Ship forms: one HTML (about 879 KB, no bundled data) or an Android WebView APK.

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
│   ├── core.test.cjs          # 65 unit tests (Node, no browser)
│   ├── browser-harness.js     # injected into the built page
│   ├── run-browser-test.cjs   # static checks + 175 headless-Edge assertions
│   ├── run-idb-test.cjs       # 26 real-clock IndexedDB assertions (CDP; skips without Chromium)
│   ├── run-ui-test.cjs        # 8 real-clock interaction assertions (viewer gestures/Esc + wide tables)
│   ├── run-screenshots.cjs    # writes docs/images/*
│   ├── persist-test.cjs       # file:// persistence check
│   └── fixtures/notes.zip     # zip-parsing fixture
├── docs/
│   ├── images/                # screenshots used by README
│   └── research/              # comparable tools research
├── android/                   # WebView APK project (Gradle)
└── .github/workflows/
    ├── build-apk.yml          # push to main → debug APK artifact
    └── release.yml            # push tag v* → auto release on GitHub + Gitee
```

---

## Release automation (v1.12.7+)

Pushing a `v*` tag runs `.github/workflows/release.yml`, which does everything the old manual 8-step flow did:

1. **Version guard**: `APP_VERSION` (app.js), `package.json`, `versionName` (gradle) must all equal the tag (`v1.2.3` → `1.2.3`), and `versionCode` must be present — otherwise the run fails before building.
2. Build dist (`scripts/build.py`) + debug APK (same SDK/gradle steps as `build-apk.yml`), verify the APK's embedded `assets/index.html` contains the tagged version.
3. Release notes generated from `git log <prev-tag>..<tag> --oneline`.
4. **GitHub Release** created (`gh release create` + `upload --clobber`, idempotent on re-run).
5. **Bot commit to main** (only when the tag points at `origin/main` HEAD): root `MDFlashCards-v*.apk` replaced (old removed), README download links sed-ed to the new filename, `latest.json` written — commit message ends with `[skip ci]` so it doesn't re-trigger `build-apk.yml`. These files aren't in its `paths:` filter anyway.
6. **Gitee mirror**: push `main` + the tag to Gitee with the `GITEE_TOKEN` secret, then create the Gitee Release via API (form-encoded, body from notes.md) and upload the APK via `attach_files`.

Gitee quirks baked into the script: release lookup is `/releases/tags/{tag}` (NOT `/releases/tag/`), a missing release returns **HTTP 200 + `null`** (hence the `(json.load(...) or {})` guard), and the asset list never includes attachment `id`s — so re-runs **skip** the upload when a same-name attachment already exists instead of deleting it (delete manually on the web UI if a re-upload is ever needed).

**So a release is now: bump the three version files (app.js / package.json / gradle versionCode+versionName) → commit → push main → `git tag v1.x.y && git push origin v1.x.y`.** Do NOT touch `latest.json` or the root APK manually — the workflow writes them. Requires the repo secret `GITEE_TOKEN` (Gitee personal token).

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
| backup | `backupJson` (via `stripAiKeys` — single-deck JSON export never contains API keys or images)/`showExport`/`downloadFile` (AndroidSaver bridge first)/`buildBackupZipFiles` + `exportBackupZip` (full zip: `backup.json` + `images/`)/`parseBackupBuffer`/`importBackupBuffer` |
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
node tests/core.test.cjs            # 65 tests, Node 18+ (DecompressionStream)
node tests/run-browser-test.cjs     # static checks + 175 headless Edge assertions
node tests/run-idb-test.cjs         # 26 real-clock IndexedDB assertions (CDP; Node 22+ — global WebSocket)
node tests/run-ui-test.cjs          # 8 real-clock interaction assertions (CDP; Node 22+)
node tests/run-screenshots.cjs      # docs/images screenshots
node tests/persist-test.cjs         # file:// persistence
```

CI: `.github/workflows/tests.yml` runs `core` plus the three browser suites on every PR and on `workflow_dispatch` (Node 22, `REQUIRE_BROWSER=1` so a missing browser fails instead of silently skipping). `build-apk.yml` / `release.yml` run the pure-Node suite before shipping.

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
| 1.6 | repo build ships without bundled deck data (gitignored, regenerable); settings view (theme dark/light, zh-Hans/zh-Hant/en i18n, about page); dist reduced to a single file |
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
| 1.11.0 | data safety: `Core.zipStore` (store-mode zip writer, CRC32, roundtrips with unzipFiles/Python); full backup = zip with backup.json+images/, deck export json gains `kind:'deck'`; import parses zip/legacy json → preview modal → overwrite (double confirm) / merge (`mergeBackupState`: id-match, conflict → name+suffix copy, stats only fill missing); failures never touch local state; images: content-digest dedup + auto-rename (`img-2.png`) with same-batch reference rewrite (`IMG_RENAMES`); unreferenced-image cleanup (settings + auto after deck delete; deletes each `img/<name>` blob via `Store.rawDelete` first, then rewrites `imgIndex`); deck delete keeps stats of cards shared with other decks; backup reminder bar (lastChangeAt/lastBackupAt/7d, dismissible) + File System Access folder one-tap zip; Android `saveBinary`/`shareFile` bridge |
| 1.12.0 | content & platform: KaTeX inlined via build-time `read_katex()` (JS + CSS with base64 subset fonts, `/*KATEX*/` placeholder; math pre-extracted in `renderMathSegments`/`restoreMath`, parse errors fall back to raw text); lightweight regex highlighter `highlightCode` hooked via `window.__mdfcHighlight` (+copy button, overflow-x); image viewer overlay (pinch/double-tap); reading settings (fs/lh/cw → CSS vars); global search (`globalSearch` + debounce + snippet modal + review-from-card); card ops edit/split/merge/move + one-level undo (`snapshotForUndo`), edit writes back to `deck.raw` when uniquely locatable, `modified` badge; tags (frontmatter + inline #tag) & deck sorting; Obsidian callouts in core quote branch + `linkWikiCards` jump; Q_TMPL per-UI-language; Android: SEND/VIEW intents → `__externalImport` (md text/b64), PIN lock (native dialog + salted SHA, auto-lock 5min), AlarmManager daily reminder + BootReceiver; headless virtual budget 90s & poll-count boot wait |
| 1.12.2 | fixes: copy button resolves `pre` via `.md-code-wrap` and reads `data-raw`; `isMathCandidate` also rejects English words, currency and numeric ranges (`5 to`, `5-`, `20-30`, `USD`); `cleanupUnreferencedImages` `Store.rawDelete`s each orphan blob BEFORE rewriting imgIndex; `deleteCardById` keeps stats of cards shared with other decks; overwrite/merge/legacy-import all clear `lastOpSnapshot`; legacy editor recomputes id + flags `modified` + migrates stats; PIN wipe polls `window.__wipeDone` before recreate; manifest duplicate permissions removed |
| 1.12.3 | fixes: `highlightCode` no longer ESC-escapes already-escaped text (code blocks showed `&lt;`/`&amp;` literally); code-copy reads `pre.dataset.raw` directly (browser already decoded it — extra textarea decode turned `&amp;` into `&`); `Store.close()` + `wiping`/`wipeLocked` guards so `__wipeAllData` cancels pending saves, closes the connection, then deletes (only `onsuccess` = ok; blocked/timeout keep PIN and report); Android polls and only proceeds on ok/err |
| 1.12.4 | fixes: wiping data from "forgot PIN" now also cancels the scheduled daily reminder (`cancelReminder()`) and dismisses notification id 1001 before clearing prefs and recreating — otherwise reminders kept firing after a wipe; docs: test counts (63/164) and single-file size unified; duplicate Java imports removed |
| 1.12.5 | UI fixes: sort dropdown spacing (`.sortbar` margin-bottom 12px); `settings.storage` added to zh-Hant/en dictionaries (was falling back to Simplified); settings Storage section re-laid out with `.field.stack` + `.stack-btns` (full-width buttons) + `.inline-row` (fixed-width inputs) so labels/controls no longer squeeze on narrow screens |
| 1.12.5 (upd) | same release cycle: app-lock hidden by default (`FEATURE_APP_LOCK=false` / `APP_LOCK_ENABLED=false`, `#fieldAppLock` hidden, lock screen skipped; all PIN code/bridge/wipe path kept — flip both booleans to restore); UI wording PIN → 密码/密碼/password |
| 1.12.6 | UI fix: `.resume-bar` gets `margin-bottom: 10px` through `:not(:empty)`, so the resume button no longer touches the import button right below it; with no unfinished session the bar stays empty and contributes no space (measured `.btn` rect gap 0px → 10px, empty state unchanged) |
| 1.12.7 | release automation: new `.github/workflows/release.yml` — pushing a `v*` tag builds dist+APK, creates the GitHub Release with the APK, bot-commits root APK + README links + `latest.json` to main (`[skip ci]`), mirror-pushes main+tag to Gitee with the `GITEE_TOKEN` secret, and creates the Gitee Release + uploads the APK via `attach_files`; version guard fails the run if tag ≠ version files. See "Release automation" section above |
| 1.12.15 | interaction/import fixes: (1) `renderCard` now resets the internal reveal flag — reshuffle/language switch hid the answer but `showAnswer` was blocked by `review.revealed` while Space still rated the card; (2) an image that fails again after the one-shot URL retry now falls through to the 「图片无法显示」 chip instead of leaving alt text; (3) when the viewer is open, Esc / Android back closes only the viewer (keyboard no longer closes the modal underneath or rates with Space/1/2/3); (4) images in the browse/edit modal open the viewer (`#modalBox img`); (5) AI same-name JSON import asks before replacing a deck — cancel keeps the old cards and stats; (6) every dynamic `data-deck`/`data-card` attribute is escaped, so imported ids cannot inject DOM; (7) batch import disambiguates duplicate basenames by folder (`a/note`, `b/note`) instead of overwriting; (8) backup zip accepts `images/` at any nesting depth, so a re-zipped backup restores images; (9) backup/export copy matches reality (full backup contains images, single-deck JSON does not). New regressions: 7 IDB assertions + 1 UI Esc assertion, each verified failing on the v1.12.14 artifact before the fix |
| 1.12.14 | polish: (1) paragraph mode no longer splits a code block at blank lines inside it (fenced block stays whole and balanced); (2) header-only tables no longer emit a stray `</tbody>`; (3) `[[…]]` inside `<pre>`/`<code>` is left as text instead of becoming a card link; (4) dropped the ineffective 60-hit cap in `globalSearch` — the panel renders 30 and now reports the exact remaining count; (5) defensive prune: a session whose `rated >= total` with empty queues but a leftover `currentId` is cleared on home render (legit `rated < total` pauses are untouched); (6) ambiguous same-name images are rewritten to a `__mdfc_ambiguous__/<name>` sentinel and render as an 「重名」 placeholder instead of an arbitrary image; (7) import dialog copy now says images are renamed and references rewritten (the old text claimed overwrite); (8) a rejected image job no longer stalls the import queue; dead code removed; CI runs the pure-Node suite and an optional browser job |
| 1.12.13 | stability fixes: (1) finishing a review now persists the empty session immediately — previously a restart brought back "resume: 1 card remaining" and re-showed an already-rated card, double-counting stats; `rate()` also clears `current` before saving, so a kill mid-rate cannot resurrect the rated card. (2) folder/multi-file import now rewrites renamed image references by **relative path** (same as zip); with no directory info it deliberately leaves references untouched instead of guessing. (3) IndexedDB open failure/timeout is retried on the next call instead of caching `null` for the session (which silently disabled all image I/O). (4) undoing a rating now also decrements today's counter and flushes. (5) the home sort dropdown follows the saved setting. (6) corrupt image records (key without blob) are overwritten instead of aborting the import |
| 1.12.12 | viewer + table UX: the image viewer only scaled — one-finger drag did nothing (`touchmove` with one finger just called `preventDefault`), pinch ignored the midpoint, and the only way out was tapping the backdrop. Rewritten: one-finger pan when `scale > 1`, clamp so the image cannot be dragged off-screen, pinch keeps the midpoint fixed (and pans with it), double-tap zooms to 2.5x **at the tap point**, and a horizontal swipe (>70 px, <700 ms, |dx| > 1.5|dy|) at 1x slides the image out and closes the viewer (`dir` → translate 45vw + fade, 180 ms). Zoom is floored at 1x. Desktop mouse drag + wheel zoom kept for testing. Tables: `table { min-width:100% }` with `overflow-x` on the *inner* box let Blink squeeze columns instead of scrolling; now `.md-table-wrap` is the single scroll container (`overflow-x:auto`, thin scrollbar, `overscroll-behavior-x: contain`), the table is `width:max-content; min-width:100%`, and cells get `min-width:4.5em; max-width:26em` — wide tables scroll, narrow ones stay flush. New `tests/run-ui-test.cjs` (CDP, real clock, synthetic Touch/Mouse events): double-tap → 2.5x, one-finger pan changes translate3d, pinch grows scale, swipe-left hides the viewer, wide table `scrollWidth > clientWidth` with cell ≥ 60 px, narrow table does not overflow, and re-opening the viewer 3x does not stack gesture listeners (a 60 px drag moves exactly 60 px) |
| 1.12.11 | duplicate-basename fix: zip imports store images by basename and `storeImage` was called via `Promise.all`, so two files named `img001.png` in different folders both saw "name free" and committed the same IDB key — the last write won and the other file was lost (measured on the user's 49 MB / 251-image zip: 198 stored, 53 lost). The batch-wide `text.split(base).join(newName)` rewrite then pointed every md's reference at the same surviving file (measured: 50 of 215 references rendered somebody else's image). Fixes: `importImageEntries` / `importImageFiles` / `storeBackupImages` store serially (deterministic `name`, `-2`, `-3`); `storeImage` now resolves to the stored name and fills an `outMap[zipPath]`; new `rewriteZipImageRefs(text, mdDir, pathMap)` rewrites each reference by its **full zip path** (falls back to `zipJoin('', ref)` for root-relative refs, and to basename only when that basename is unique — never guesses on duplicates); `zipJoin` normalises `./`/`..`. Zip import now toasts `toast.imgLost` when some images fail to store. Re-running the same zip after the fix: 251 stored, 256/256 references resolve to the correct original file (0 wrong, 0 broken). Tests: +5 pure rewrite assertions in browser harness (169 total), +1 IDB assertion (same basename ×3 → 3 distinct names, all decodable, 9 total) |
| 1.12.10 | image-MIME fix: Android pickers/providers report `svg` (and other non-mainstream types) as `application/octet-stream` or empty, and the app stored the `File` as-is in `storeImage`. Chromium sniffs PNG/JPEG so those still render, but an `<img>` only treats a blob as SVG when its MIME is `image/svg+xml` — so every SVG in the note failed to decode and Blink painted the alt text (the filename) into the image box. Measured with a blob probe: svg + `image/svg+xml` → 240×120, svg + `''`/`octet-stream`/`text/plain`/`image/png` → broken; png renders under all of those. Fixes: new `normalizeImageBlob()` re-wraps a blob with the MIME derived from its name, applied in `storeImage` (store time), in the digest-dedupe branch (re-import self-heal) and in `loadStoredImages` (legacy records recover at boot without re-import); boot now awaits image URLs before the first render; `resolveImgSrc` tags replaced images with `data-img`; a capture-phase `error` listener replaces genuinely undecodable images with the `img.missing` chip (`img.broken`, 3 languages) instead of leaving giant alt text, retrying once when `IMG_URLS` has a newer URL. Repair toast reports `retyped`. IDB suite grew to 8 assertions (store-time retype, bad-MIME decodes=false + dedupe heal, legacy empty-MIME retype at load, broken-image chip fallback) |
| 1.12.9 | release-workflow fix: `notes.md` is now written to `$RUNNER_TEMP` (used by `gh release create` and the Gitee `body@` field). Previously it lived in the repo root and the bot-commit step deleted it before the Gitee step read it, which failed the v1.12.8 release at the upload step; only `gitee-*.json` API responses are removed from the workspace now, so `git add -A` stays clean without breaking later steps |
| 1.12.8 | image-loss fix: `storeImage` ran multiple stores in parallel (`Promise.all` over a whole zip) and each did read-modify-write on `imgIndex` — concurrent transactions lost updates (measured: 40 parallel stores → 1 index entry, all 40 blobs on disk), so after a restart/update every image rendered as 图片未导入 and re-importing the same zip could not help because the digest-dedupe path returned `true` without touching the index. Fixes: all `imgIndex` mutations go through a serialized promise chain (`withImgIndex`) — store, index add and cleanup included; the dedupe path now calls `rememberImage` + `addToImgIndex` so a re-import self-heals; `repairImageIndex()` rebuilds the index from real IDB keys (`getAllKeys`, `img/` prefix) on every boot (re-render when entries were recovered) and behind a new 设置 → 存储 → 修复图片索引 button, so an already-corrupted library recovers without deleting the note. New `tests/run-idb-test.cjs` runs under a real clock via CDP because IDB is unreliable in the virtual-time harness |
