/*!
 * MD 笔记闪卡 · 界面逻辑
 * 依赖 core.js 暴露的 window.MDReviewCore
 */
(function () {
  'use strict';

  var Core = window.MDReviewCore;
  if (!Core) return;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var ESC = Core.escapeHtml;

  var GRAN = { fine: 800, mid: 1600, coarse: 3000 };
  // 值为 i18n 键，展示时经 t() 翻译
  var MODE_LABELS = {
    auto: 'mode.auto',
    h2: 'mode.h2',
    h3: 'mode.h3',
    qa: 'mode.qa',
    hr: 'mode.hr',
    para: 'mode.para'
  };
  var QSTYLE_LABELS = {
    prompt: 'qstyle.prompt',
    title: 'qstyle.title',
    cloze: 'qstyle.cloze'
  };
  var AI_BATCH_CHARS = 5000;
  var AI_TIMEOUT = 60000;
  var APP_VERSION = '1.7.3';
  var LANGS = ['zh-Hans', 'zh-Hant', 'en'];
  var THEMES = ['dark', 'light'];

  /* ============================== 多语言 ============================== */

  var I18N = {
    'zh-Hans': {
      'app.title': 'MD 笔记闪卡 · 随机复习',
      'brand.name': 'MD 笔记闪卡',
      'brand.tag': 'md → 知识点卡片 → 随机复习',
      'nav.manage': '笔记管理', 'nav.settings': '设置',
      'hero.title': '导入长篇笔记，拆成多张闪记卡', 'hero.sub': '随时复习，闪速记忆',
      'btn.import': '📥 导入 md / zip', 'btn.paste': '✍️ 粘贴 Markdown 文本', 'btn.demo': '看看示例（10 张卡）',
      'btn.importBatch': '📥 导入 md / zip（批量）', 'btn.pasteShort': '粘贴文本', 'btn.backup': '备份全部', 'btn.restoreBackup': '恢复备份',
      'set.importTitle': '导入与提问设置', 'set.aiTitle': 'AI 提炼设置（可选，需要你自己的 API）',
      'settings.ai': 'AI 供应商', 'ai.active': '当前使用', 'ai.addCustom': '＋ 自定义供应商（OpenAI 兼容）',
      'ai.add': '＋ 添加供应商', 'ai.addTitle': '添加供应商',
      'ai.quickTitle': '选择模型', 'ai.manage': '管理供应商', 'ai.goSettings': '去设置',
      'home.aiBtn': '🤖 AI 提炼 · {name} ▾', 'home.aiNone': '🤖 AI 提炼 · 未配置（点击去设置）',
      'ai.customName': '自定义供应商', 'ai.models': '模型列表（逗号分隔）', 'ai.model': '当前模型',
      'ai.presetTag': '内置',
      'ai.noneEnabled': '没有已启用的供应商：请在下方启用一个并填写 API 地址与模型。',
      'ai.using': '使用 {name} · {model}',
      'confirm.deleteProvider': '删除供应商「{name}」？（其 API Key 将一并清除）',
      'ai.keyLocalNote': 'API Key 只保存在本机浏览器（IndexedDB），请求直接从本机发往对应厂商，不经任何服务器、不上传云端；「备份全部」导出的文件也不包含 Key。',
      'label.mode': '拆分方式', 'label.qstyle': '提问风格', 'label.gran': '卡片粒度',
      'label.aiBase': 'API 地址', 'label.aiModel': '模型名', 'label.aiKey': 'API Key',
      'mode.auto': '自动（推荐）', 'mode.h2': '按二级标题 ##', 'mode.h3': '按三级标题 ###',
      'mode.qa': '按问答 Q:/A:', 'mode.hr': '按分隔线 ---', 'mode.para': '按段落',
      'qstyle.prompt': '提问式（推荐）', 'qstyle.title': '标题式（不生成提问）', 'qstyle.cloze': '挖空式（填空）',
      'gran.fine': '细（≤800 字/张）', 'gran.mid': '中（≤1600 字/张）', 'gran.coarse': '粗（≤3000 字/张）',
      'set.importNote': '改动后，<b>下次导入</b>的笔记按新设置拆分；已导入的可以删掉重导。',
      'btn.aiTest': '测试连接', 'btn.aiImport': '导入 AI 卡片',
      'set.aiNote': '不经过任何服务器，请求从本机直接发到你在上面填的地址。浏览器直连多数厂商 API 可能被跨域拦截（CORS）：可以用本机 <b>Ollama</b>（启动前设 <code>OLLAMA_ORIGINS=*</code>），或改用电脑上的 <code>tools/ai_cards.py</code> 生成卡片 JSON，再用「导入 AI 卡片」。',
      'foot.tips': '数据只保存在本机浏览器里，不上传任何服务器。<br>换手机 / 清理浏览器前，记得用「备份」导出 json，再到新手机「恢复」。<br>手机浏览器菜单里选「添加到主屏幕」，可以像 App 一样打开。',
      'aria.back': '返回', 'aria.reshuffle': '重新洗牌', 'aria.resetProgress': '重置本笔记进度',
      'aria.toc': '题目目录', 'aria.toggleAll': '展开/收起全部', 'aria.restoreBundled': '恢复内置题库',
      'rv.hint': '轻点卡片显示答案', 'btn.show': '显示答案',
      'rate.bad': '忘了', 'rate.fuzzy': '模糊', 'rate.ok': '记住了',
      'ph.browseSearch': '搜索标题 / 内容…', 'ph.quickSearch': '搜索题目 / 答案…',
      'manage.title': '笔记管理', 'manage.note': '删除只影响本机卡片与进度，不会改你的原始 md 文件；内置题库删掉后用右上角 ↻ 可恢复。',
      'settings.title': '设置', 'settings.general': '通用设置', 'settings.theme': '主题', 'settings.lang': '语言', 'settings.about': '关于',
      'theme.dark': '深色', 'theme.light': '浅色',
      'lang.zhHans': '简体中文', 'lang.zhHant': '繁體中文', 'lang.en': 'English',
      'about.name': 'MD闪记卡', 'about.author': '作者：fest',
      'about.feedback': '如有 bug 和建议反馈，可联系邮箱：<a href="mailto:fest1024@163.com">fest1024@163.com</a>',
      'home.allCards': '全部卡片 <b>{n}</b>', 'home.todoCards': '只看没掌握 <b>{n}</b>', 'home.today': '今日已复习 <b>{n}</b>',
      'deck.meta': '{n} 张卡片 · <span class="ok">已掌握 {k}</span> · <span class="todo">待复习 {t}</span>',
      'deck.review': '随机复习', 'deck.quick': '分类速记', 'deck.browse': '浏览/编辑',
      'deck.ai': 'AI 提炼', 'deck.export': '导出', 'deck.delete': '删除',
      'deck.reviewAll': '🎲 全部笔记混合随机复习',
      'toast.tooShort': '内容太短，没有导入', 'toast.noCards': '没有解析出卡片，试试换个「拆分方式」',
      'confirm.replaceDeck': '已存在同名笔记「{name}」，用新内容替换吗？（尽量保留已掌握进度）',
      'toast.cancelled': '已取消', 'toast.imported': '已导入「{name}」 {n} 张卡片',
      'import.title': '导入笔记', 'import.pick': '📄 选择文件（md 笔记 + 图片，可多选）', 'import.zip': '🗜️ 选择 .zip（多篇 md + 图片）', 'import.dir': '📁 导入整个文件夹（电脑端，含图片）',
      'import.note': '图片按<b>文件名</b>匹配 md 里的引用（如 ![](images/a.png) 取 a.png），同名会覆盖。图片只存本机，<b>「备份全部」不含图片</b>，换机后重新导入即可。zip 只在本地解压，不上传。',
      'import.empty': '还没有选择文件', 'import.doAll': '导入全部', 'import.doAllCount': '导入全部（{n}）',
      'toast.onlyMd': '未识别的文件（支持 md / txt / 图片）', 'toast.noFile': '没有选择文件',
      'toast.imgTaken': '已导入 {n} 张图片', 'toast.imgNoStore': '本机存储不可用，图片没有保存', 'img.missing': '图片未导入',
      'toast.notZip': '请选择 .zip 文件', 'toast.unzipping': '正在解压…', 'toast.zipEmpty': 'zip 里没有找到 md / 图片文件',
      'toast.zipTaken': '已从 zip 中取出 {n} 篇笔记', 'toast.unzipFail': '解压失败：{msg}',
      'toast.queueEmpty': '先选择要导入的文件',
      'confirm.batchReplace': '有 {n} 个同名笔记，用新内容替换吗？（取消 = 跳过同名）',
      'toast.importing': '开始导入 {n} 个文件…', 'toast.importDone': '导入完成：{ok} / {total} 个笔记', 'toast.readFail': '读取失败：{name}',
      'paste.title': '粘贴 Markdown 文本', 'paste.name': '笔记名称', 'paste.ph': '把 md 内容粘贴到这里…',
      'paste.note': '提示：按标题拆分会自动识别 # / ## / ###；如果笔记里是「Q: … A: …」格式，选「按问答」更准。',
      'toast.pasteEmpty': '还没有粘贴内容', 'paste.defaultName': '粘贴笔记', 'btn.ok': '导入',
      'btn.cancel': '取消', 'btn.close': '关闭', 'btn.save': '保存', 'btn.delete': '删除',
      'ai.noBase': '还没填写 API 地址（例如 https://api.deepseek.com/v1）', 'ai.noModel': '还没填写模型名（例如 deepseek-chat）',
      'ai.timeout': '请求超时（{s}s）', 'ai.netFail': '网络/跨域(CORS)失败：浏览器直连这个 API 被拒绝',
      'ai.notJson': '返回内容不是 JSON：', 'ai.noContent': '返回里没有 choices[0].message.content',
      'ai.corsHelp': '跨域说明：浏览器直连多数厂商 API 会被 CORS 拦。可以改用支持跨域的中转/网关、本机 Ollama（启动时设 OLLAMA_ORIGINS=*），或者用电脑上的 tools/ai_cards.py 生成卡片 JSON 再导入。',
      'ai.testNeedBase': '先填写 API 地址，例如 https://api.deepseek.com/v1', 'ai.testTitle': '测试 AI 连接',
      'ai.testing': '请求中…（最长等 {s} 秒）', 'ai.testOk': '连接成功', 'ai.testFail': '连接失败', 'ai.modelReply': '模型回复：',
      'ai.title': 'AI 提炼提问', 'ai.desc': '用大模型读懂每张卡的答案，把标题改写成更像面试题的问题（<b>只改题面，不动答案</b>）。请求从你的手机直接发出，不经过任何服务器。',
      'ai.notConfigured': '还没有配置 AI：先在首页展开「AI 提炼设置」填 API 地址、模型名和 key。',
      'ai.cardCount': '共 {n} 张卡', 'ai.ready': '已就绪', 'ai.notReady': '未配置', 'ai.start': '开始提炼',
      'ai.busy': '正在提炼，请稍等', 'ai.needConfig': '先配置 AI 地址和模型',
      'ai.progress': '提炼中… {done} / {total} 张（共 {batches} 批）',
      'ai.badFormat': '返回格式无法解析（需要 {"questions":[{"idx":..,"q":".."}]}）',
      'ai.done': '完成：改写 {n} 张卡', 'ai.doneFail': '完成：改写 {n} 张卡，{m} 批失败',
      'toast.badJson': '不是有效的 JSON 文件', 'toast.noDecks': '文件里没有 decks / cards',
      'card.untitled': '未命名', 'deck.aiDefault': 'AI 卡片', 'toast.nothingToImport': '没有可导入的卡片', 'toast.aiImported': '已导入 AI 卡片 {n} 张',
      'review.noTodo': '没有「没掌握」的卡片，先全部过一遍吧', 'review.noCards': '没有可复习的卡片',
      'review.allDecks': '全部笔记 · {n} 个文件', 'deck.defaultName': '笔记',
      'review.round2': '进入第 2 轮：再过一遍模糊/忘记的 {n} 张', 'review.round2Label': '第 2 轮',
      'review.progress': '本轮 {rated} / {total} · 还剩 {left} 张',
      'review.done': '本轮完成', 'review.again': '🔁 再随机来一轮', 'review.againTodo': '只复习没掌握的', 'review.backList': '返回列表', 'review.finished': '本轮结束',
      'browse.meta': '{n} 张卡片 · 已掌握 {k}', 'browse.noMatch': '没有匹配的卡片',
      'card.editTitle': '编辑卡片', 'card.title': '标题', 'card.question': '题面（可留空）', 'card.answer': '答案（支持 Markdown）',
      'card.editNote': '改动只保存在本机；导出备份可换手机。', 'toast.answerEmpty': '答案不能为空', 'confirm.deleteCard': '删除这张卡片？',
      'toast.saved': '已保存', 'toast.deleted': '已删除',
      'bundled.none': '没有内置题库可恢复', 'bundled.restored': '已恢复内置题库：{n} 张卡片',
      'quick.uncategorized': '未分类', 'quick.meta': '{n} 张卡片 · {c} 个章节',
      'quick.all': '全部 <b>{n}</b>', 'quick.tocHead': '题目目录 · {n} 题（点一下跳转）',
      'quick.count': '{n} 题', 'quick.expand': '展开', 'quick.collapse': '收起', 'quick.noMatch': '没有匹配的内容',
      'manage.meta': '{n} 个笔记 · {c} 张卡片', 'manage.empty': '还没有笔记，先导入 md 吧',
      'src.bundled': '内置题库', 'src.ai': 'AI 卡片', 'src.local': '本地导入',
      'manage.rename': '重命名', 'manage.reset': '重置进度',
      'rename.title': '重命名笔记', 'rename.note': '只改显示名称，卡片和复习进度不变。',
      'toast.nameEmpty': '名称不能为空', 'toast.renamed': '已重命名',
      'confirm.resetProgress': '把「{name}」的复习进度全部清零？', 'toast.progressCleared': '进度已清零',
      'export.title': '导出备份', 'export.note': '{kb} KB · 含卡片与复习进度。下载后文件在手机「下载」目录；也可以复制文本自行保存。',
      'export.copy': '复制文本', 'export.download': '下载 .json',
      'toast.savedToDownloads': '已保存到手机「下载」目录：{name}', 'toast.downloading': '已开始下载（若没反应请用「复制文本」）',
      'toast.downloadFail': '下载失败，请用「复制文本」', 'toast.copied': '已复制', 'toast.copyFail': '复制失败，请手动全选复制',
      'toast.badBackup': '文件不是有效的备份', 'confirm.importBackup': '导入备份会覆盖当前所有笔记和进度，确定继续？',
      'toast.backupImported': '备份已导入：{n} 个笔记', 'confirm.deleteDeck': '删除笔记「{name}」及其 {n} 张卡片？',
      'toast.noNotes': '还没有笔记', 'toast.noImportYet': '还没有笔记，先导入 md 吧',
      'toast.reshuffled': '已重新洗牌', 'toast.readFailGeneric': '读取失败', 'deck.untitledNote': '未命名笔记',
      'toast.modeChanged': '拆分方式已切换，下次导入生效', 'toast.granChanged': '卡片粒度已切换，下次导入生效', 'toast.qstyleChanged': '提问风格已切换，下次导入生效',
      'toast.themeChanged': '主题已切换', 'toast.langChanged': '语言已切换',
      'card.known': '已掌握', 'card.learning': '待巩固', 'card.new': '未复习',
      'review.summaryRemembered': '记住了', 'review.summaryFuzzy': '模糊', 'review.summaryBad': '忘了'
    },
    'zh-Hant': {
      'app.title': 'MD 筆記閃卡 · 隨機複習',
      'brand.name': 'MD 筆記閃卡',
      'brand.tag': 'md → 知識點卡片 → 隨機複習',
      'nav.manage': '筆記管理', 'nav.settings': '設定',
      'hero.title': '匯入長篇筆記，拆成多張閃記卡', 'hero.sub': '隨時複習，閃速記憶',
      'btn.import': '📥 匯入 md / zip', 'btn.paste': '✍️ 貼上 Markdown 文字', 'btn.demo': '看看範例（10 張卡）',
      'btn.importBatch': '📥 匯入 md / zip（批次）', 'btn.pasteShort': '貼上文字', 'btn.backup': '備份全部', 'btn.restoreBackup': '還原備份',
      'set.importTitle': '匯入與提問設定', 'set.aiTitle': 'AI 提煉設定（可選，需要你自己的 API）',
      'settings.ai': 'AI 供應商', 'ai.active': '當前使用', 'ai.addCustom': '＋ 自訂供應商（OpenAI 相容）',
      'ai.add': '＋ 新增供應商', 'ai.addTitle': '新增供應商',
      'ai.quickTitle': '選擇模型', 'ai.manage': '管理供應商', 'ai.goSettings': '去設定',
      'home.aiBtn': '🤖 AI 提煉 · {name} ▾', 'home.aiNone': '🤖 AI 提煉 · 未設定（點擊去設定）',
      'ai.customName': '自訂供應商', 'ai.models': '模型清單（逗號分隔）', 'ai.model': '當前模型',
      'ai.presetTag': '內建',
      'ai.noneEnabled': '沒有已啟用的供應商：請在下方啟用一個並填寫 API 位址與模型。',
      'ai.using': '使用 {name} · {model}',
      'confirm.deleteProvider': '刪除供應商「{name}」？（其 API Key 將一併清除）',
      'ai.keyLocalNote': 'API Key 只保存在本機瀏覽器（IndexedDB），請求直接從本機發往對應廠商，不經任何伺服器、不上傳雲端；「備份全部」匯出的檔案也不包含 Key。',
      'label.mode': '拆分方式', 'label.qstyle': '提問風格', 'label.gran': '卡片粒度',
      'label.aiBase': 'API 位址', 'label.aiModel': '模型名稱', 'label.aiKey': 'API Key',
      'mode.auto': '自動（推薦）', 'mode.h2': '按二級標題 ##', 'mode.h3': '按三級標題 ###',
      'mode.qa': '按問答 Q:/A:', 'mode.hr': '按分隔線 ---', 'mode.para': '按段落',
      'qstyle.prompt': '提問式（推薦）', 'qstyle.title': '標題式（不生成提問）', 'qstyle.cloze': '挖空式（填空）',
      'gran.fine': '細（≤800 字/張）', 'gran.mid': '中（≤1600 字/張）', 'gran.coarse': '粗（≤3000 字/張）',
      'set.importNote': '改動後，<b>下次匯入</b>的筆記按新設定拆分；已匯入的可以刪掉重匯。',
      'btn.aiTest': '測試連線', 'btn.aiImport': '匯入 AI 卡片',
      'set.aiNote': '不經過任何伺服器，請求從本機直接發到你在上面填的位址。瀏覽器直連多數廠商 API 可能被跨域攔截（CORS）：可以用本機 <b>Ollama</b>（啟動前設 <code>OLLAMA_ORIGINS=*</code>），或改用電腦上的 <code>tools/ai_cards.py</code> 生成卡片 JSON，再用「匯入 AI 卡片」。',
      'foot.tips': '資料只保存在本機瀏覽器裡，不上傳任何伺服器。<br>換手機 / 清理瀏覽器前，記得用「備份」匯出 json，再到新手機「還原」。<br>手機瀏覽器選單裡選「加到主畫面」，可以像 App 一樣開啟。',
      'aria.back': '返回', 'aria.reshuffle': '重新洗牌', 'aria.resetProgress': '重設本筆記進度',
      'aria.toc': '題目目錄', 'aria.toggleAll': '展開/收起全部', 'aria.restoreBundled': '還原內建題庫',
      'rv.hint': '輕點卡片顯示答案', 'btn.show': '顯示答案',
      'rate.bad': '忘了', 'rate.fuzzy': '模糊', 'rate.ok': '記住了',
      'ph.browseSearch': '搜尋標題 / 內容…', 'ph.quickSearch': '搜尋題目 / 答案…',
      'manage.title': '筆記管理', 'manage.note': '刪除只影響本機卡片與進度，不會改你的原始 md 檔案；內建題庫刪掉後用右上角 ↻ 可還原。',
      'settings.title': '設定', 'settings.general': '一般設定', 'settings.theme': '主題', 'settings.lang': '語言', 'settings.about': '關於',
      'theme.dark': '深色', 'theme.light': '淺色',
      'lang.zhHans': '简体中文', 'lang.zhHant': '繁體中文', 'lang.en': 'English',
      'about.name': 'MD閃記卡', 'about.author': '作者：fest',
      'about.feedback': '如有 bug 和建議回饋，可聯絡郵箱：<a href="mailto:fest1024@163.com">fest1024@163.com</a>',
      'home.allCards': '全部卡片 <b>{n}</b>', 'home.todoCards': '只看沒掌握 <b>{n}</b>', 'home.today': '今日已複習 <b>{n}</b>',
      'deck.meta': '{n} 張卡片 · <span class="ok">已掌握 {k}</span> · <span class="todo">待複習 {t}</span>',
      'deck.review': '隨機複習', 'deck.quick': '分類速記', 'deck.browse': '瀏覽/編輯',
      'deck.ai': 'AI 提煉', 'deck.export': '匯出', 'deck.delete': '刪除',
      'deck.reviewAll': '🎲 全部筆記混合隨機複習',
      'toast.tooShort': '內容太短，沒有匯入', 'toast.noCards': '沒有解析出卡片，試試換個「拆分方式」',
      'confirm.replaceDeck': '已存在同名筆記「{name}」，用新內容替換嗎？（盡量保留已掌握進度）',
      'toast.cancelled': '已取消', 'toast.imported': '已匯入「{name}」 {n} 張卡片',
      'import.title': '匯入筆記', 'import.pick': '📄 選擇檔案（md 筆記 + 圖片，可多選）', 'import.zip': '🗜️ 選擇 .zip（多篇 md + 圖片）', 'import.dir': '📁 匯入整個資料夾（電腦端，含圖片）',
      'import.note': '圖片按<b>檔名</b>匹配 md 裡的引用（如 ![](images/a.png) 取 a.png），同名會覆蓋。圖片只存本機，<b>「備份全部」不含圖片</b>，換機後重新匯入即可。zip 只在本機解壓，不上傳。',
      'import.empty': '還沒有選擇檔案', 'import.doAll': '匯入全部', 'import.doAllCount': '匯入全部（{n}）',
      'toast.onlyMd': '未識別的檔案（支援 md / txt / 圖片）', 'toast.noFile': '沒有選擇檔案',
      'toast.imgTaken': '已匯入 {n} 張圖片', 'toast.imgNoStore': '本機儲存不可用，圖片沒有保存', 'img.missing': '圖片未匯入',
      'toast.notZip': '請選擇 .zip 檔案', 'toast.unzipping': '正在解壓…', 'toast.zipEmpty': 'zip 裡沒有找到 md / 圖片檔案',
      'toast.zipTaken': '已從 zip 中取出 {n} 篇筆記', 'toast.unzipFail': '解壓失敗：{msg}',
      'toast.queueEmpty': '先選擇要匯入的檔案',
      'confirm.batchReplace': '有 {n} 個同名筆記，用新內容替換嗎？（取消 = 跳過同名）',
      'toast.importing': '開始匯入 {n} 個檔案…', 'toast.importDone': '匯入完成：{ok} / {total} 個筆記', 'toast.readFail': '讀取失敗：{name}',
      'paste.title': '貼上 Markdown 文字', 'paste.name': '筆記名稱', 'paste.ph': '把 md 內容貼到這裡…',
      'paste.note': '提示：按標題拆分會自動辨識 # / ## / ###；如果筆記裡是「Q: … A: …」格式，選「按問答」更準。',
      'toast.pasteEmpty': '還沒有貼上內容', 'paste.defaultName': '貼上筆記', 'btn.ok': '匯入',
      'btn.cancel': '取消', 'btn.close': '關閉', 'btn.save': '儲存', 'btn.delete': '刪除',
      'ai.noBase': '還沒填寫 API 位址（例如 https://api.deepseek.com/v1）', 'ai.noModel': '還沒填寫模型名稱（例如 deepseek-chat）',
      'ai.timeout': '請求逾時（{s}s）', 'ai.netFail': '網路/跨域(CORS)失敗：瀏覽器直連這個 API 被拒絕',
      'ai.notJson': '返回內容不是 JSON：', 'ai.noContent': '返回裡沒有 choices[0].message.content',
      'ai.corsHelp': '跨域說明：瀏覽器直連多數廠商 API 會被 CORS 攔。可以改用支援跨域的中轉/閘道、本機 Ollama（啟動時設 OLLAMA_ORIGINS=*），或者用電腦上的 tools/ai_cards.py 生成卡片 JSON 再匯入。',
      'ai.testNeedBase': '先填寫 API 位址，例如 https://api.deepseek.com/v1', 'ai.testTitle': '測試 AI 連線',
      'ai.testing': '請求中…（最長等 {s} 秒）', 'ai.testOk': '連線成功', 'ai.testFail': '連線失敗', 'ai.modelReply': '模型回覆：',
      'ai.title': 'AI 提煉提問', 'ai.desc': '用大模型讀懂每張卡的答案，把標題改寫成更像面試題的問題（<b>只改題面，不動答案</b>）。請求從你的手機直接發出，不經過任何伺服器。',
      'ai.notConfigured': '還沒有設定 AI：先在首頁展開「AI 提煉設定」填 API 位址、模型名稱和 key。',
      'ai.cardCount': '共 {n} 張卡', 'ai.ready': '已就緒', 'ai.notReady': '未設定', 'ai.start': '開始提煉',
      'ai.busy': '正在提煉，請稍等', 'ai.needConfig': '先設定 AI 位址和模型',
      'ai.progress': '提煉中… {done} / {total} 張（共 {batches} 批）',
      'ai.badFormat': '返回格式無法解析（需要 {"questions":[{"idx":..,"q":".."}]}）',
      'ai.done': '完成：改寫 {n} 張卡', 'ai.doneFail': '完成：改寫 {n} 張卡，{m} 批失敗',
      'toast.badJson': '不是有效的 JSON 檔案', 'toast.noDecks': '檔案裡沒有 decks / cards',
      'card.untitled': '未命名', 'deck.aiDefault': 'AI 卡片', 'toast.nothingToImport': '沒有可匯入的卡片', 'toast.aiImported': '已匯入 AI 卡片 {n} 張',
      'review.noTodo': '沒有「沒掌握」的卡片，先全部過一遍吧', 'review.noCards': '沒有可複習的卡片',
      'review.allDecks': '全部筆記 · {n} 個檔案', 'deck.defaultName': '筆記',
      'review.round2': '進入第 2 輪：再過一遍模糊/忘記的 {n} 張', 'review.round2Label': '第 2 輪',
      'review.progress': '本輪 {rated} / {total} · 還剩 {left} 張',
      'review.done': '本輪完成', 'review.again': '🔁 再隨機來一輪', 'review.againTodo': '只複習沒掌握的', 'review.backList': '返回列表', 'review.finished': '本輪結束',
      'browse.meta': '{n} 張卡片 · 已掌握 {k}', 'browse.noMatch': '沒有匹配的卡片',
      'card.editTitle': '編輯卡片', 'card.title': '標題', 'card.question': '題面（可留空）', 'card.answer': '答案（支援 Markdown）',
      'card.editNote': '改動只保存在本機；匯出備份可換手機。', 'toast.answerEmpty': '答案不能為空', 'confirm.deleteCard': '刪除這張卡片？',
      'toast.saved': '已儲存', 'toast.deleted': '已刪除',
      'bundled.none': '沒有內建題庫可還原', 'bundled.restored': '已還原內建題庫：{n} 張卡片',
      'quick.uncategorized': '未分類', 'quick.meta': '{n} 張卡片 · {c} 個章節',
      'quick.all': '全部 <b>{n}</b>', 'quick.tocHead': '題目目錄 · {n} 題（點一下跳轉）',
      'quick.count': '{n} 題', 'quick.expand': '展開', 'quick.collapse': '收起', 'quick.noMatch': '沒有匹配的內容',
      'manage.meta': '{n} 個筆記 · {c} 張卡片', 'manage.empty': '還沒有筆記，先匯入 md 吧',
      'src.bundled': '內建題庫', 'src.ai': 'AI 卡片', 'src.local': '本機匯入',
      'manage.rename': '重新命名', 'manage.reset': '重設進度',
      'rename.title': '重新命名筆記', 'rename.note': '只改顯示名稱，卡片和複習進度不變。',
      'toast.nameEmpty': '名稱不能為空', 'toast.renamed': '已重新命名',
      'confirm.resetProgress': '把「{name}」的複習進度全部清零？', 'toast.progressCleared': '進度已清零',
      'export.title': '匯出備份', 'export.note': '{kb} KB · 含卡片與複習進度。下載後檔案在手機「下載」目錄；也可以複製文字自行保存。',
      'export.copy': '複製文字', 'export.download': '下載 .json',
      'toast.savedToDownloads': '已保存到手機「下載」目錄：{name}', 'toast.downloading': '已開始下載（若沒反應請用「複製文字」）',
      'toast.downloadFail': '下載失敗，請用「複製文字」', 'toast.copied': '已複製', 'toast.copyFail': '複製失敗，請手動全選複製',
      'toast.badBackup': '檔案不是有效的備份', 'confirm.importBackup': '匯入備份會覆蓋當前所有筆記和進度，確定繼續？',
      'toast.backupImported': '備份已匯入：{n} 個筆記', 'confirm.deleteDeck': '刪除筆記「{name}」及其 {n} 張卡片？',
      'toast.noNotes': '還沒有筆記', 'toast.noImportYet': '還沒有筆記，先匯入 md 吧',
      'toast.reshuffled': '已重新洗牌', 'toast.readFailGeneric': '讀取失敗', 'deck.untitledNote': '未命名筆記',
      'toast.modeChanged': '拆分方式已切換，下次匯入生效', 'toast.granChanged': '卡片粒度已切換，下次匯入生效', 'toast.qstyleChanged': '提問風格已切換，下次匯入生效',
      'toast.themeChanged': '主題已切換', 'toast.langChanged': '語言已切換',
      'card.known': '已掌握', 'card.learning': '待鞏固', 'card.new': '未複習',
      'review.summaryRemembered': '記住了', 'review.summaryFuzzy': '模糊', 'review.summaryBad': '忘了'
    },
    'en': {
      'app.title': 'MD FlashCards · Random Review',
      'brand.name': 'MD FlashCards',
      'brand.tag': 'md → cards → random review',
      'nav.manage': 'Notes', 'nav.settings': 'Settings',
      'hero.title': 'Import long notes, split into flashcards', 'hero.sub': 'Review anytime, remember fast',
      'btn.import': '📥 Import md / zip', 'btn.paste': '✍️ Paste Markdown text', 'btn.demo': 'Try the sample (10 cards)',
      'btn.importBatch': '📥 Import md / zip (batch)', 'btn.pasteShort': 'Paste text', 'btn.backup': 'Backup all', 'btn.restoreBackup': 'Restore backup',
      'set.importTitle': 'Import & question settings', 'set.aiTitle': 'AI refine settings (optional, your own API)',
      'settings.ai': 'AI providers', 'ai.active': 'Active provider', 'ai.addCustom': '＋ Custom provider (OpenAI-compatible)',
      'ai.add': '＋ Add provider', 'ai.addTitle': 'Add provider',
      'ai.quickTitle': 'Choose model', 'ai.manage': 'Manage providers', 'ai.goSettings': 'Open settings',
      'home.aiBtn': '🤖 AI refine · {name} ▾', 'home.aiNone': '🤖 AI refine · not set (tap to configure)',
      'ai.customName': 'Custom provider', 'ai.models': 'Models (comma separated)', 'ai.model': 'Active model',
      'ai.presetTag': 'Built-in',
      'ai.noneEnabled': 'No provider is enabled — enable one below and fill in its API URL and model.',
      'ai.using': 'Using {name} · {model}',
      'confirm.deleteProvider': 'Delete provider "{name}"? Its API key will be removed too.',
      'ai.keyLocalNote': 'API keys are stored only in this browser (IndexedDB); requests go straight from this device to the provider and never touch a server. Backup files contain no keys.',
      'label.mode': 'Split mode', 'label.qstyle': 'Question style', 'label.gran': 'Card size',
      'label.aiBase': 'API URL', 'label.aiModel': 'Model', 'label.aiKey': 'API Key',
      'mode.auto': 'Auto (recommended)', 'mode.h2': 'By heading level 2 (##)', 'mode.h3': 'By heading level 3 (###)',
      'mode.qa': 'By Q:/A: pairs', 'mode.hr': 'By divider (---)', 'mode.para': 'By paragraph',
      'qstyle.prompt': 'Prompt style (recommended)', 'qstyle.title': 'Title only', 'qstyle.cloze': 'Cloze (fill in the blank)',
      'gran.fine': 'Fine (≤800 chars/card)', 'gran.mid': 'Medium (≤1600 chars/card)', 'gran.coarse': 'Coarse (≤3000 chars/card)',
      'set.importNote': 'Changes apply to <b>the next import</b>; re-import existing notes to re-split them.',
      'btn.aiTest': 'Test connection', 'btn.aiImport': 'Import AI cards',
      'set.aiNote': 'No server involved: requests go straight from this device to the API you enter. Most LLM APIs block browser calls via CORS — use local <b>Ollama</b> (set <code>OLLAMA_ORIGINS=*</code> before starting), or run <code>tools/ai_cards.py</code> on a PC to generate card JSON, then use "Import AI cards".',
      'foot.tips': 'All data stays in this browser; nothing is uploaded.<br>Before switching phones or clearing browser data, export a json backup and restore it on the new device.<br>Use your browser menu → "Add to Home Screen" to use it like an app.',
      'aria.back': 'Back', 'aria.reshuffle': 'Reshuffle', 'aria.resetProgress': 'Reset progress for this note',
      'aria.toc': 'Question outline', 'aria.toggleAll': 'Expand/collapse all', 'aria.restoreBundled': 'Restore bundled decks',
      'rv.hint': 'Tap the card to reveal the answer', 'btn.show': 'Show answer',
      'rate.bad': 'Forgot', 'rate.fuzzy': 'Fuzzy', 'rate.ok': 'Got it',
      'ph.browseSearch': 'Search title / content…', 'ph.quickSearch': 'Search question / answer…',
      'manage.title': 'Notes', 'manage.note': 'Deleting only affects local cards and progress; your original md files are never modified. Deleted bundled decks can be restored with ↻.',
      'settings.title': 'Settings', 'settings.general': 'General', 'settings.theme': 'Theme', 'settings.lang': 'Language', 'settings.about': 'About',
      'theme.dark': 'Dark', 'theme.light': 'Light',
      'lang.zhHans': '简体中文', 'lang.zhHant': '繁體中文', 'lang.en': 'English',
      'about.name': 'MD闪记卡', 'about.author': 'Author: fest',
      'about.feedback': 'Bugs & suggestions: <a href="mailto:fest1024@163.com">fest1024@163.com</a>',
      'home.allCards': 'All cards <b>{n}</b>', 'home.todoCards': 'Not mastered <b>{n}</b>', 'home.today': 'Reviewed today <b>{n}</b>',
      'deck.meta': '{n} cards · <span class="ok">{k} known</span> · <span class="todo">{t} to go</span>',
      'deck.review': 'Review', 'deck.quick': 'Quick read', 'deck.browse': 'Browse/Edit',
      'deck.ai': 'AI refine', 'deck.export': 'Export', 'deck.delete': 'Delete',
      'deck.reviewAll': '🎲 Mixed review of all notes',
      'toast.tooShort': 'Content too short — not imported', 'toast.noCards': 'No cards parsed; try another split mode',
      'confirm.replaceDeck': 'A note named "{name}" already exists. Replace it with the new content? (mastered progress is kept where possible)',
      'toast.cancelled': 'Cancelled', 'toast.imported': 'Imported "{name}" — {n} cards',
      'import.title': 'Import notes', 'import.pick': '📄 Pick files (md notes + images, multi-select)', 'import.zip': '🗜️ Pick a .zip (md files + images)', 'import.dir': '📁 Import a whole folder (desktop, images included)',
      'import.note': 'Images are matched by <b>filename</b> against references in the md (e.g. ![](images/a.png) uses a.png); same-name images overwrite. Images stay on this device and are <b>not included in backups</b> — re-import after switching devices. Zip files are unpacked locally, nothing is uploaded.',
      'import.empty': 'No files selected yet', 'import.doAll': 'Import all', 'import.doAllCount': 'Import all ({n})',
      'toast.onlyMd': 'Unrecognized files (md / txt / images only)', 'toast.noFile': 'No file selected',
      'toast.imgTaken': 'Imported {n} images', 'toast.imgNoStore': 'Local storage unavailable, images not saved', 'img.missing': 'Image not imported',
      'toast.notZip': 'Please choose a .zip file', 'toast.unzipping': 'Unpacking…', 'toast.zipEmpty': 'No .md / .txt files found in the zip',
      'toast.zipTaken': 'Extracted {n} notes from the zip', 'toast.unzipFail': 'Unpack failed: {msg}',
      'toast.queueEmpty': 'Select files to import first',
      'confirm.batchReplace': '{n} notes share names with existing ones. Replace them? (Cancel = skip those)',
      'toast.importing': 'Importing {n} files…', 'toast.importDone': 'Import finished: {ok} / {total} notes', 'toast.readFail': 'Read failed: {name}',
      'paste.title': 'Paste Markdown text', 'paste.name': 'Note name', 'paste.ph': 'Paste md content here…',
      'paste.note': 'Tip: heading-based splitting detects # / ## / ### automatically; if the note uses "Q: … A: …" format, pick "By Q:/A:" instead.',
      'toast.pasteEmpty': 'Nothing pasted yet', 'paste.defaultName': 'Pasted note', 'btn.ok': 'Import',
      'btn.cancel': 'Cancel', 'btn.close': 'Close', 'btn.save': 'Save', 'btn.delete': 'Delete',
      'ai.noBase': 'API URL is missing (e.g. https://api.deepseek.com/v1)', 'ai.noModel': 'Model name is missing (e.g. deepseek-chat)',
      'ai.timeout': 'Request timed out ({s}s)', 'ai.netFail': 'Network/CORS failure: the browser was blocked from calling this API',
      'ai.notJson': 'Response is not JSON: ', 'ai.noContent': 'Response has no choices[0].message.content',
      'ai.corsHelp': 'About CORS: most LLM APIs block direct browser calls. Use a CORS-enabled proxy, local Ollama (set OLLAMA_ORIGINS=* when starting), or run tools/ai_cards.py on a PC to build card JSON and import it.',
      'ai.testNeedBase': 'Enter the API URL first, e.g. https://api.deepseek.com/v1', 'ai.testTitle': 'Test AI connection',
      'ai.testing': 'Requesting… (up to {s} s)', 'ai.testOk': 'Connected', 'ai.testFail': 'Connection failed', 'ai.modelReply': 'Model reply: ',
      'ai.title': 'AI question refine', 'ai.desc': 'Have an LLM rewrite each card\'s title into an interview-style question (<b>questions only, answers untouched</b>). Requests go straight from your phone to the API; no server in between.',
      'ai.notConfigured': 'AI is not configured: expand "AI refine settings" on the home screen and fill in the API URL, model and key.',
      'ai.cardCount': '{n} cards', 'ai.ready': 'Ready', 'ai.notReady': 'Not configured', 'ai.start': 'Start refine',
      'ai.busy': 'Refine in progress, please wait', 'ai.needConfig': 'Configure the API URL and model first',
      'ai.progress': 'Refining… {done} / {total} cards ({batches} batches)',
      'ai.badFormat': 'Unparseable response (expected {"questions":[{"idx":..,"q":".."}]})',
      'ai.done': 'Done: {n} cards rewritten', 'ai.doneFail': 'Done: {n} cards rewritten, {m} batches failed',
      'toast.badJson': 'Not a valid JSON file', 'toast.noDecks': 'No decks / cards in the file',
      'card.untitled': 'Untitled', 'deck.aiDefault': 'AI cards', 'toast.nothingToImport': 'No importable cards', 'toast.aiImported': 'Imported {n} AI cards',
      'review.noTodo': 'No unmastered cards left — review everything once more', 'review.noCards': 'No cards to review',
      'review.allDecks': 'All notes · {n} files', 'deck.defaultName': 'Note',
      'review.round2': 'Round 2: replaying the {n} fuzzy/forgotten cards', 'review.round2Label': 'Round 2',
      'review.progress': 'This round {rated} / {total} · {left} left',
      'review.done': 'Round complete', 'review.again': '🔁 Another random round', 'review.againTodo': 'Review unmastered only', 'review.backList': 'Back to list', 'review.finished': 'Round finished',
      'browse.meta': '{n} cards · {k} known', 'browse.noMatch': 'No matching cards',
      'card.editTitle': 'Edit card', 'card.title': 'Title', 'card.question': 'Question (optional)', 'card.answer': 'Answer (Markdown)',
      'card.editNote': 'Changes are saved locally; export a backup to move them to another phone.', 'toast.answerEmpty': 'Answer cannot be empty', 'confirm.deleteCard': 'Delete this card?',
      'toast.saved': 'Saved', 'toast.deleted': 'Deleted',
      'bundled.none': 'No bundled decks to restore', 'bundled.restored': 'Bundled decks restored: {n} cards',
      'quick.uncategorized': 'Uncategorized', 'quick.meta': '{n} cards · {c} chapters',
      'quick.all': 'All <b>{n}</b>', 'quick.tocHead': 'Question outline · {n} (tap to jump)',
      'quick.count': '{n} Q', 'quick.expand': 'Expand', 'quick.collapse': 'Collapse', 'quick.noMatch': 'No matching content',
      'manage.meta': '{n} notes · {c} cards', 'manage.empty': 'No notes yet — import some md files first',
      'src.bundled': 'Bundled', 'src.ai': 'AI cards', 'src.local': 'Local import',
      'manage.rename': 'Rename', 'manage.reset': 'Reset progress',
      'rename.title': 'Rename note', 'rename.note': 'Only the display name changes; cards and progress are untouched.',
      'toast.nameEmpty': 'Name cannot be empty', 'toast.renamed': 'Renamed',
      'confirm.resetProgress': 'Reset all review progress for "{name}"?', 'toast.progressCleared': 'Progress cleared',
      'export.title': 'Export backup', 'export.note': '{kb} KB · includes cards and review progress. The file lands in your phone\'s Downloads folder; you can also copy the text.',
      'export.copy': 'Copy text', 'export.download': 'Download .json',
      'toast.savedToDownloads': 'Saved to phone Downloads: {name}', 'toast.downloading': 'Download started (if nothing happens, use "Copy text")',
      'toast.downloadFail': 'Download failed — use "Copy text"', 'toast.copied': 'Copied', 'toast.copyFail': 'Copy failed — select and copy manually',
      'toast.badBackup': 'Not a valid backup file', 'confirm.importBackup': 'Importing a backup overwrites all current notes and progress. Continue?',
      'toast.backupImported': 'Backup imported: {n} notes', 'confirm.deleteDeck': 'Delete note "{name}" and its {n} cards?',
      'toast.noNotes': 'No notes yet', 'toast.noImportYet': 'No notes yet — import some md files first',
      'toast.reshuffled': 'Reshuffled', 'toast.readFailGeneric': 'Read failed', 'deck.untitledNote': 'Untitled note',
      'toast.modeChanged': 'Split mode changed; applies to the next import', 'toast.granChanged': 'Card size changed; applies to the next import', 'toast.qstyleChanged': 'Question style changed; applies to the next import',
      'toast.themeChanged': 'Theme changed', 'toast.langChanged': 'Language changed',
      'card.known': 'Known', 'card.learning': 'Learning', 'card.new': 'New',
      'review.summaryRemembered': 'Got it', 'review.summaryFuzzy': 'Fuzzy', 'review.summaryBad': 'Forgot'
    }
  };

  function currentLang() {
    var l = state && state.settings && state.settings.lang;
    return LANGS.indexOf(l) >= 0 ? l : 'zh-Hans';
  }

  function t(key) {
    var d = I18N[currentLang()];
    if (d && d[key] != null) return d[key];
    var fb = I18N['zh-Hans'];
    return fb[key] != null ? fb[key] : key;
  }

  function tf(key, map) {
    var s = t(key);
    for (var k in (map || {})) s = s.split('{' + k + '}').join(String(map[k]));
    return s;
  }

  function applyI18nStatic() {
    var lang = currentLang();
    document.documentElement.lang = lang === 'en' ? 'en' : (lang === 'zh-Hant' ? 'zh-Hant' : 'zh-CN');
    document.title = t('app.title');
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].innerHTML = t(nodes[i].getAttribute('data-i18n'));
    }
    nodes = document.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].setAttribute('placeholder', t(nodes[j].getAttribute('data-i18n-ph')));
    }
    nodes = document.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < nodes.length; a++) {
      nodes[a].setAttribute('aria-label', t(nodes[a].getAttribute('data-i18n-aria')));
    }
    nodes = document.querySelectorAll('[data-i18n-title]');
    for (var b = 0; b < nodes.length; b++) {
      nodes[b].setAttribute('title', t(nodes[b].getAttribute('data-i18n-title')));
    }
    var v = $('#aboutVersion');
    if (v) v.textContent = 'v' + APP_VERSION;
  }

  function applyTheme() {
    var light = state && state.settings && state.settings.theme === 'light';
    document.body.classList.toggle('light', !!light);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#eef2f9' : '#0a0d14');
  }


  var SAMPLE_MD = [
    '# 示例 · 计算机网络 & 操作系统',
    '',
    '这是内置示例，用来演示「长笔记 → 卡片 → 随机复习」。导入你自己的 md 后会替换掉。',
    '',
    '## TCP 为什么需要三次握手？',
    '',
    '两次握手无法确认「客户端的接收能力」和「服务端的历史连接请求」：',
    '',
    '1. 防止已失效的连接请求突然又传到服务端，造成资源浪费；',
    '2. 只有三次握手才能让双方都确认对方的收发能力正常。',
    '',
    '## HTTP 和 HTTPS 的区别',
    '',
    '| 维度 | HTTP | HTTPS |',
    '| --- | --- | --- |',
    '| 加密 | 明文 | TLS 加密 |',
    '| 端口 | 80 | 443 |',
    '| 证书 | 无 | 需要 CA 证书 |',
    '',
    '## 进程和线程的区别',
    '',
    'Q: 进程和线程最核心的区别是什么？',
    'A: 进程是资源分配的基本单位，线程是 CPU 调度的基本单位；同一进程内的线程共享地址空间，切换开销更小。',
    '',
    'Q: 协程和线程的区别？',
    'A: 协程是用户态调度，切换不需要内核参与，开销远小于线程；但协程不能利用多核，需要配合多线程。',
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
    '→ 层数低（3~4 层可存千万级），磁盘 IO 次数少；范围查询友好。',
    '```',
    '',
    '对比哈希索引：哈希只适合等值查询，不支持范围查询和排序。',
    '',
    '## 什么是虚拟内存',
    '',
    '虚拟内存给每个进程一个独立的、连续的地址空间，由 MMU + 页表映射到物理内存；',
    '好处是隔离、按需调页、可以运行比物理内存更大的程序，代价是缺页中断。'
  ].join('\n');

  /* ============================== 存储 ============================== */

  var Store = (function () {
    var LS_KEY = 'mdreview.state.v1';
    var db = null;
    var dbPromise = null;

    function openDB() {
      // 缓存同一个连接 Promise：并发调用（boot 加载中又来写图片）不再拿到未就绪的 db
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve) {
        if (typeof indexedDB === 'undefined') return resolve(null);
        var settled = false;
        var finish = function (v) { if (!settled) { settled = true; db = v; resolve(v); } };
        var req;
        try {
          req = indexedDB.open('md-review', 1);
        } catch (e) {
          return finish(null);
        }
        req.onupgradeneeded = function () {
          try { req.result.createObjectStore('kv'); } catch (e) { /* ignore */ }
        };
        req.onsuccess = function () { finish(req.result); };
        req.onerror = function () { finish(null); };
        req.onblocked = function () { finish(null); };
        setTimeout(function () { finish(null); }, 1200);
      });
      return dbPromise;
    }

    function idbGet(key) {
      return new Promise(function (resolve) {
        if (!db) return resolve(null);
        try {
          var tx = db.transaction('kv', 'readonly');
          var r = tx.objectStore('kv').get(key);
          r.onsuccess = function () { resolve(r.result == null ? null : r.result); };
          r.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }

    function idbPut(key, val) {
      return new Promise(function (resolve) {
        if (!db) return resolve(false);
        try {
          var tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(val, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }

    function lsGet() {
      try { return window.localStorage.getItem(LS_KEY); } catch (e) { return null; }
    }
    function lsSet(v) {
      try { window.localStorage.setItem(LS_KEY, v); return true; } catch (e) { return false; }
    }

    return {
      load: function () {
        return openDB().then(function () {
          return idbGet('state').then(function (v) {
            if (v != null) return v;
            return lsGet();
          });
        }).catch(function () { return lsGet(); });
      },
      save: function (json) {
        return openDB().then(function () {
          if (db) {
            return idbPut('state', json).then(function (ok) {
              if (!ok) lsSet(json);
              return ok;
            });
          }
          return lsSet(json);
        }).catch(function () { return lsSet(json); });
      },
      rawGet: function (key) { return openDB().then(function () { return idbGet(key); }); },
      rawPut: function (key, val) { return openDB().then(function () { return idbPut(key, val); }); }
    };
  })();

  /* ============================== 状态 ============================== */

  var state = null;
  var saveTimer = null;
  var toastTimer = null;
  var review = null;
  var browse = { deckId: null, q: '' };
  var quick = { deckId: null, q: '', chapter: '', collapsed: {}, tocOpen: false, highlight: '' };
  var modalPayload = null;
  var viewStack = 0;

  function uid(prefix) {
    return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ============================== AI 供应商 ============================== */

  // 模型列表为各厂商开放平台 2026-10 现行版本（deepseek-flash = DeepSeek-V4.1-Flash-1017）
  var AI_PRESETS = [
    { id: 'preset-deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com', models: ['deepseek-flash'], protocol: 'openai' },
    { id: 'preset-zai', name: 'Z.ai', base: 'https://api.z.ai/api/paas/v4', models: ['glm-5.3', 'glm-5.3-flash'], protocol: 'openai' },
    { id: 'preset-kimi', name: 'Kimi', base: 'https://api.moonshot.cn/v1', models: ['kimi-k3.1-pro', 'kimi-k3'], protocol: 'openai' },
    { id: 'preset-bailian', name: 'Bailian', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen3.8-max', 'qwen3.7-plus', 'qwen3.8-flash'], protocol: 'openai' },
    { id: 'preset-openai', name: 'ChatGPT', base: 'https://api.openai.com/v1', models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna'], protocol: 'openai' },
    { id: 'preset-claude', name: 'Claude', base: 'https://api.anthropic.com', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'], protocol: 'anthropic' }
  ];

  // 历史预置默认值：用于识别「用户从未改过」的旧预置，自动升级到现行模型
  var AI_LEGACY_DEFAULTS = {
    'preset-deepseek': { base: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
    'preset-zai': { base: 'https://api.z.ai/api/paas/v4', models: ['glm-4.6', 'glm-4.5-air'] },
    'preset-kimi': { base: 'https://api.moonshot.cn/v1', models: ['kimi-k2-0905-preview', 'moonshot-v1-8k'] },
    'preset-bailian': { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max', 'qwen-plus', 'qwen-flash'] },
    'preset-openai': { base: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
    'preset-claude': { base: 'https://api.anthropic.com', models: ['claude-sonnet-4-5', 'claude-haiku-4-5'] }
  };

  function sameList(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function emptyAi() {
    return { activeId: '', providers: [], removed: [] };
  }

  function normalizeAi(raw) {
    var ai = emptyAi();
    if (raw && Array.isArray(raw.providers)) {
      raw.providers.forEach(function (p) {
        if (!p || typeof p !== 'object') return;
        ai.providers.push({
          id: String(p.id || uid('p')),
          name: String(p.name || '').slice(0, 40),
          base: typeof p.base === 'string' ? p.base : '',
          key: typeof p.key === 'string' ? p.key : '',
          models: Array.isArray(p.models) ? p.models.filter(function (m) { return typeof m === 'string' && m.trim(); }).map(function (m) { return m.trim(); }).slice(0, 20) : [],
          model: typeof p.model === 'string' ? p.model : '',
          enabled: !!p.enabled,
          protocol: p.protocol === 'anthropic' ? 'anthropic' : 'openai',
          preset: !!p.preset
        });
      });
      if (typeof raw.activeId === 'string') ai.activeId = raw.activeId;
      if (Array.isArray(raw.removed)) ai.removed = raw.removed.filter(function (x) { return typeof x === 'string'; });
    } else if (raw && typeof raw === 'object' && (raw.base || raw.model || raw.key)) {
      // v1.6 及更早的单供应商配置 → 迁移为一个自定义供应商
      var model = typeof raw.model === 'string' ? raw.model.trim() : '';
      ai.providers.push({
        id: 'p-migrated', name: t('ai.customName'),
        base: typeof raw.base === 'string' ? raw.base : '',
        key: typeof raw.key === 'string' ? raw.key : '',
        models: model ? [model] : [], model: model,
        enabled: !!(raw.base && model), protocol: 'openai', preset: false
      });
      ai.activeId = 'p-migrated';
    }
    // 预置供应商不再自动播种：由用户在设置页「添加供应商」时按需加入
    AI_PRESETS.forEach(function (ps) {
      for (var i = 0; i < ai.providers.length; i++) {
        if (ai.providers[i].id === ps.id) {
          var p = ai.providers[i];
          p.preset = true;
          // 未填 Key 且模型列表仍是历史默认值的预置 → 自动升级到现行模型
          var legacy = AI_LEGACY_DEFAULTS[ps.id];
          if (legacy && !p.key && p.base === legacy.base && sameList(p.models, legacy.models)) {
            p.base = ps.base;
            p.models = ps.models.slice();
            p.model = ps.models[0] || p.model;
          }
          break;
        }
      }
    });
    // 当前使用兜底：优先已启用的供应商
    var byId = {};
    ai.providers.forEach(function (p) { byId[p.id] = p; });
    var active = byId[ai.activeId];
    if (!active || !active.enabled) {
      var firstEnabled = '';
      ai.providers.forEach(function (p) { if (!firstEnabled && p.enabled) firstEnabled = p.id; });
      ai.activeId = firstEnabled || (ai.providers[0] ? ai.providers[0].id : '');
    }
    return ai;
  }

  function aiState() {
    return (state && state.settings && state.settings.ai) || emptyAi();
  }

  function findProvider(id) {
    var list = aiState().providers;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function activeProvider() {
    var ai = aiState();
    var p = findProvider(ai.activeId);
    if (p && p.enabled) return p;
    for (var i = 0; i < ai.providers.length; i++) if (ai.providers[i].enabled) return ai.providers[i];
    return null;
  }

  function aiReady() {
    var p = activeProvider();
    return !!(p && p.base && p.model);
  }

  function emptyState() {
    return {
      version: 1,
      decks: [],
      stats: {},
      daily: {},
      settings: {
        mode: 'auto',
        gran: 'mid',
        qstyle: 'prompt',
        filter: 'all',
        theme: 'dark',
        lang: 'zh-Hans',
        bundledVersion: '',
        ai: emptyAi()
      }
    };
  }

  function normalizeState(raw) {
    var s = emptyState();
    if (!raw || typeof raw !== 'object') {
      s.settings.ai = normalizeAi(null);
      return s;
    }
    if (Array.isArray(raw.decks)) {
      raw.decks.forEach(function (d) {
        if (!d || !Array.isArray(d.cards)) return;
        var cards = d.cards.filter(function (c) {
          return c && c.id && typeof c.answer === 'string' && c.answer.length > 0;
        }).map(function (c) {
          return {
            id: String(c.id),
            title: c.title || '',
            question: c.question || '',
            answer: c.answer,
            path: Array.isArray(c.path) ? c.path : []
          };
        });
        if (!cards.length) return;
        s.decks.push({
          id: d.id || uid('d'),
          name: d.name || t('deck.untitledNote'),
          title: d.title || '',
          createdAt: d.createdAt || Date.now(),
          mode: d.mode || 'auto',
          qstyle: d.qstyle || 'prompt',
          raw: typeof d.raw === 'string' ? d.raw : '',
          source: typeof d.source === 'string' ? d.source : '',
          bundled: !!d.bundled,
          cards: cards
        });
      });
    }
    if (raw.stats && typeof raw.stats === 'object') s.stats = raw.stats;
    if (raw.daily && typeof raw.daily === 'object') s.daily = raw.daily;
    if (raw.settings && typeof raw.settings === 'object') {
      Object.keys(s.settings).forEach(function (k) {
        if (raw.settings[k] != null) s.settings[k] = raw.settings[k];
      });
    }
    if (!GRAN[s.settings.gran]) s.settings.gran = 'mid';
    if (!MODE_LABELS[s.settings.mode]) s.settings.mode = 'auto';
    if (!QSTYLE_LABELS[s.settings.qstyle]) s.settings.qstyle = 'prompt';
    if (s.settings.filter !== 'todo') s.settings.filter = 'all';
    if (THEMES.indexOf(s.settings.theme) < 0) s.settings.theme = 'dark';
    if (LANGS.indexOf(s.settings.lang) < 0) s.settings.lang = 'zh-Hans';
    s.settings.ai = normalizeAi(raw.settings && raw.settings.ai);
    return s;
  }

  function pruneDaily() {
    var keys = Object.keys(state.daily);
    if (keys.length < 200) return;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 120);
    var min = cutoff.getFullYear() + '-' + pad2(cutoff.getMonth() + 1) + '-' + pad2(cutoff.getDate());
    keys.forEach(function (k) {
      if (k < min) delete state.daily[k];
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      var json = JSON.stringify(state);
      Store.save(json).catch(function () {});
    }, 250);
  }

  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { Store.save(JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ============================== 派生数据 ============================== */

  function findDeck(id) {
    for (var i = 0; i < state.decks.length; i++) if (state.decks[i].id === id) return state.decks[i];
    return null;
  }

  function statusOf(cardId) {
    var st = state.stats[cardId];
    return st && st.s ? st.s : 'new';
  }

  function ensureStat(cardId) {
    if (!state.stats[cardId]) state.stats[cardId] = { s: 'new', n: 0, ok: 0, bad: 0, last: 0 };
    return state.stats[cardId];
  }

  function knownOf(deck) {
    var n = 0;
    deck.cards.forEach(function (c) { if (statusOf(c.id) === 'known') n++; });
    return n;
  }

  function bumpDaily() {
    var k = todayKey();
    state.daily[k] = (state.daily[k] || 0) + 1;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ============================== 通用 UI ============================== */

  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }

  function openModal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modalBox').innerHTML = '';
    modalPayload = null;
    document.body.style.overflow = '';
  }

  function showView(name, noPush) {
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    var v = $('#view-' + name);
    if (v) v.classList.add('active');
    if (name !== 'home' && !noPush) {
      try { window.history.pushState({ view: name }, ''); viewStack++; } catch (e) { /* file:// 等环境忽略 */ }
    }
    window.scrollTo(0, 0);
  }

  function goHome() {
    if (review) review = null;
    renderHome();
    showView('home', true);
  }

  function goBack() {
    if (viewStack > 0) {
      try { window.history.back(); return; } catch (e) { /* fallthrough */ }
    }
    goHome();
  }

  function readFileText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || '')); };
      fr.onerror = function () { reject(fr.error || new Error('read error')); };
      fr.readAsText(file);
    });
  }

  /* ---------- 用户导入的图片（md 里 ![](images/x.png) 按文件名匹配） ---------- */
  var IMG_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i;
  var ZIP_ACCEPT_RE = /\.(md|markdown|txt|png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i;
  var IMG_URLS = {}; // basename → objectURL

  function imgBase(name) { return String(name || '').split('/').pop().split('\\').pop(); }
  function isImageFile(name) { return IMG_EXT_RE.test(String(name || '')); }

  function imgMime(name) {
    var m = IMG_EXT_RE.exec(String(name || ''));
    if (!m) return 'application/octet-stream';
    var e = m[1].toLowerCase();
    if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
    if (e === 'svg') return 'image/svg+xml';
    if (e === 'heic' || e === 'heif') return 'image/heic';
    return 'image/' + e;
  }

  function loadStoredImages() {
    Store.rawGet('imgIndex').then(function (list) {
      (list || []).forEach(function (n) {
        Store.rawGet('img/' + n).then(function (rec) {
          if (rec && rec.blob) {
            try { IMG_URLS[n] = URL.createObjectURL(rec.blob); } catch (e) { /* ignore */ }
          }
        });
      });
    });
  }

  function rememberImage(base, blob) {
    if (IMG_URLS[base]) { try { URL.revokeObjectURL(IMG_URLS[base]); } catch (e) { /* ignore */ } }
    try { IMG_URLS[base] = URL.createObjectURL(blob); return true; } catch (e) { return false; }
  }

  function storeImage(name, blob) {
    var base = imgBase(name);
    return Store.rawPut('img/' + base, { blob: blob, name: base, added: Date.now() }).then(function (ok) {
      if (!ok) return false;
      rememberImage(base, blob);
      return Store.rawGet('imgIndex').then(function (list) {
        list = list || [];
        if (list.indexOf(base) >= 0) return true;
        list.push(base);
        return Store.rawPut('imgIndex', list).then(function () { return true; });
      });
    });
  }

  function importImageEntries(entries) { // [{name, bytes}]（zip 内）→ Promise(成功数)
    var n = 0;
    return Promise.all(entries.map(function (en) {
      if (!en || !en.bytes) return Promise.resolve();
      return storeImage(en.name, new Blob([en.bytes], { type: imgMime(en.name) })).then(function (ok) {
        if (ok) n++;
      });
    })).then(function () { return n; });
  }

  function importImageFiles(files) { // File[] → Promise(成功数)
    var n = 0;
    return Promise.all(files.map(function (f) {
      return storeImage(f.name, f).then(function (ok) { if (ok) n++; });
    })).then(function () { return n; });
  }

  /* 渲染后替换 <img>：本地图库命中 → objectURL；未命中且非外链 → 未导入占位 */
  function resolveImgSrc(html) {
    if (!html || html.indexOf('<img') < 0) return html;
    return html.replace(/<img\b[^>]*>/g, function (tag) {
      var m = /src="([^"]*)"/.exec(tag);
      if (!m) return tag;
      if (/^(?:https?:|blob:|data:)/i.test(m[1])) return tag;
      var base = imgBase(m[1]);
      if (IMG_URLS[base]) return tag.replace(/src="[^"]*"/, 'src="' + IMG_URLS[base] + '"');
      return '<span class="img-missing">🖼 ' + ESC(t('img.missing')) + '：' + ESC(base) + '</span>';
    });
  }

  /* ---------- 内置题库图片（（配图 xxx）→ 内嵌图） ---------- */

  var IMG_PLACEHOLDER = /（配图\s*([^）]+?)）/g;

  function deckImageSet(deck) {
    var all = window.MDReviewBundledImages;
    if (!all || !deck || !deck.name) return null;
    return all[deck.name] || null;
  }

  function renderAnswerHtml(markdown, deck) {
    var html = Core.renderMarkdown(markdown);
    var set = deckImageSet(deck);
    if (set) {
      html = html.replace(IMG_PLACEHOLDER, function (m, name) {
        var key = String(name).trim();
        var src = set[key];
        if (!src) return m;
        return '<img class="md-img" src="' + src + '" alt="' + ESC(key) + '" loading="lazy" decoding="async">';
      });
    }
    return resolveImgSrc(html);
  }

  /* ============================== 首页 ============================== */

  function renderHome() {
    var totalCards = 0;
    var knownCards = 0;
    state.decks.forEach(function (d) {
      totalCards += d.cards.length;
      knownCards += knownOf(d);
    });
    var today = state.daily[todayKey()] || 0;
    var filter = state.settings.filter;

    $('#statBar').innerHTML =
      '<button class="chip ' + (filter === 'all' ? 'on' : '') + '" data-act="set-filter" data-filter="all">' + tf('home.allCards', { n: totalCards }) + '</button>' +
      '<button class="chip ' + (filter === 'todo' ? 'on' : '') + '" data-act="set-filter" data-filter="todo">' + tf('home.todoCards', { n: totalCards - knownCards }) + '</button>' +
      '<span class="chip">' + tf('home.today', { n: today }) + '</span>';

    var hasDecks = state.decks.length > 0;
    $('#heroEmpty').classList.toggle('hidden', hasDecks);
    $('#homeBody').classList.toggle('hidden', !hasDecks);

    if (!hasDecks) {
      $('#deckList').innerHTML = '';
      return;
    }

    var html = state.decks.map(function (d) {
      var n = d.cards.length;
      var k = knownOf(d);
      var pct = n ? Math.round((k / n) * 100) : 0;
      return '' +
        '<div class="deck">' +
          '<div class="deck-top">' +
            '<div style="flex:1;min-width:0">' +
              '<div class="deck-name">' + ESC(d.name) + '</div>' +
              '<div class="deck-meta">' + tf('deck.meta', { n: n, k: k, t: n - k }) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="deck-actions">' +
            '<button class="btn sm primary" data-act="review" data-deck="' + d.id + '">' + t('deck.review') + '</button>' +
            '<button class="btn sm" data-act="quick" data-deck="' + d.id + '">' + t('deck.quick') + '</button>' +
            '<button class="btn sm" data-act="browse" data-deck="' + d.id + '">' + t('deck.browse') + '</button>' +
            '<button class="btn sm" data-act="ai-deck" data-deck="' + d.id + '">' + t('deck.ai') + '</button>' +
            '<button class="btn sm" data-act="export-deck" data-deck="' + d.id + '">' + t('deck.export') + '</button>' +
            '<button class="btn sm danger" data-act="delete-deck" data-deck="' + d.id + '">' + t('deck.delete') + '</button>' +
          '</div>' +
        '</div>';
    }).join('');

    if (state.decks.length > 1) {
      html = '<button class="btn primary big" data-act="review-all" style="margin-bottom:12px">' + t('deck.reviewAll') + '</button>' + html;
    }
    $('#deckList').innerHTML = html;

    var qb = $('#aiQuickBtn');
    if (qb) {
      var ap = activeProvider();
      qb.innerHTML = ap
        ? tf('home.aiBtn', { name: ap.name + ' · ' + (ap.model || '-') })
        : t('home.aiNone');
    }
    $('#setMode').value = state.settings.mode || 'auto';
    $('#setGran').value = state.settings.gran || 'mid';
    if ($('#setQstyle')) $('#setQstyle').value = state.settings.qstyle || 'prompt';
  }

  /* ============================== 导入 ============================== */

  function currentOpts(override) {
    var o = override || {};
    var mode = o.mode || state.settings.mode || 'auto';
    var gran = o.gran || state.settings.gran || 'mid';
    var qstyle = o.qstyle || state.settings.qstyle || 'prompt';
    return { mode: mode, gran: gran, qstyle: qstyle, maxCardLen: GRAN[gran] || 1600 };
  }

  function importText(name, text, override, behavior) {
    var b = behavior || {};
    if (!text || text.trim().length < 10) {
      if (!b.silent) toast(t('toast.tooShort'));
      return false;
    }
    var opts = currentOpts(override);
    var deck = Core.buildDeck(name, text, { mode: opts.mode, maxCardLen: opts.maxCardLen, qstyle: opts.qstyle });
    deck.source = b.source || '';
    if (!deck.cards.length) {
      if (!b.silent) toast(t('toast.noCards'));
      return false;
    }

    var existIdx = -1;
    for (var i = 0; i < state.decks.length; i++) {
      if (state.decks[i].name === deck.name) { existIdx = i; break; }
    }
    if (existIdx >= 0) {
      if (b.replace === 'no') return false;
      if (b.replace !== 'yes') {
        if (!window.confirm(tf('confirm.replaceDeck', { name: deck.name }))) {
          if (!b.silent) toast(t('toast.cancelled'));
          return false;
        }
      }
      state.decks[existIdx] = deck;
    } else {
      state.decks.push(deck);
    }
    state.settings.mode = opts.mode;
    state.settings.gran = opts.gran;
    state.settings.qstyle = opts.qstyle;
    pruneDaily();
    if (!b.silent) {
      scheduleSave();
      renderHome();
      toast(tf('toast.imported', { name: deck.name, n: deck.cards.length }), 2600);
    }
    return true;
  }

  /* ---------- 批量导入（文件队列 / zip / 文件夹） ---------- */

  var importQueue = [];

  function openImportModal() {
    importQueue = [];
    openModal(
      '<h3>' + t('import.title') + '</h3>' +
      '<div class="imp-actions">' +
        '<button class="btn primary big" data-act="imp-pick">' + t('import.pick') + '</button>' +
        '<button class="btn big" data-act="imp-zip">' + t('import.zip') + '</button>' +
        '<button class="btn big ghost" data-act="imp-dir">' + t('import.dir') + '</button>' +
      '</div>' +
      '<div id="impList" class="imp-list"></div>' +
      '<p class="modal-note">' + t('import.note') + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="imp-do">' + t('import.doAll') + '</button>' +
      '</div>'
    );
    renderImportQueue();
  }

  function renderImportQueue() {
    var box = $('#impList');
    if (!box) return;
    if (!importQueue.length) {
      box.innerHTML = '<p class="imp-empty">' + t('import.empty') + '</p>';
    } else {
      box.innerHTML = importQueue.map(function (item, idx) {
        var size = item.size ? ' · ' + (item.size / 1024).toFixed(0) + 'KB' : '';
        return '<div class="imp-item"><span class="imp-name">' + ESC(item.name) + size + '</span>' +
          '<button class="imp-del" data-act="imp-remove" data-idx="' + idx + '" aria-label="×">×</button></div>';
      }).join('');
    }
    var btn = document.querySelector('[data-act="imp-do"]');
    if (btn) btn.textContent = importQueue.length ? tf('import.doAllCount', { n: importQueue.length }) : t('import.doAll');
  }

  function isTextNote(name) {
    return /\.(md|markdown|txt)$/i.test(String(name || ''));
  }

  function addQueueFiles(files) {
    var arr = Array.prototype.slice.call(files || []);
    var added = 0;
    var imgs = [];
    var zips = []; // zip（含被文件管理器改过名的），按内容识别后路由
    arr.forEach(function (f) {
      if (isImageFile(f.name)) { imgs.push(f); return; }
      if (isTextNote(f.name)) {
        importQueue.push({ name: String(f.name).replace(/\.[^.]+$/, ''), file: f, size: f.size, source: f.name });
        added++;
        return;
      }
      zips.push(f);
    });
    var p = imgs.length ? importImageFiles(imgs) : Promise.resolve(0);
    p.then(function (nImg) {
      if (nImg) toast(tf('toast.imgTaken', { n: nImg }), 2600);
      else if (imgs.length) toast(t('toast.imgNoStore'), 4200);
      if (!added && !imgs.length && !zips.length) {
        toast(arr.length ? t('toast.onlyMd') : t('toast.noFile'));
        return;
      }
      renderImportQueue();
      zips.forEach(function (z) { addQueueZip(z); });
    });
  }

  function readFileBuffer(file) {
    if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error || new Error('read error')); };
      fr.readAsArrayBuffer(file);
    });
  }

  function addQueueZip(file) {
    if (!file) return;
    toast(t('toast.unzipping'), 4000);
    readFileBuffer(file)
      .then(function (buf) {
        // zip 识别按内容（PK 魔数），不认后缀——手机文件管理器/微信常把后缀改掉
        var b = new Uint8Array(buf);
        if (!(b.length > 3 && b[0] === 0x50 && b[1] === 0x4b)) {
          var e = new Error(t('toast.notZip'));
          e.handled = true;
          throw e;
        }
        // 注意传过滤器：core 的 unzipFiles 默认只收 md/txt，图片要一并放行
        return Core.unzipFiles(buf, ZIP_ACCEPT_RE);
      })
      .then(function (list) {
        var texts = [];
        var imgs = [];
        (list || []).forEach(function (en) {
          var nm = en.name || '';
          if (/(^|\/)__MACOSX(\/|$)/.test(nm) || /(^|\/)\._/.test(nm) || /\/$/.test(nm)) return;
          if (isImageFile(nm)) imgs.push(en);
          else if (isTextNote(nm)) texts.push(en);
        });
        return importImageEntries(imgs).then(function (nImg) {
          if (!texts.length && !nImg) { toast(t('toast.zipEmpty')); return; }
          texts.forEach(function (en) {
            var base = en.name.split('/').pop();
            importQueue.push({ name: base.replace(/\.[^.]+$/, ''), text: Core.decodeBytes(en.bytes), size: en.bytes.length, source: en.name });
          });
          renderImportQueue();
          var msg = '';
          if (texts.length) msg += tf('toast.zipTaken', { n: texts.length });
          if (nImg) msg += (msg ? '，' : '') + tf('toast.imgTaken', { n: nImg });
          if (msg) toast(msg, 3000);
        });
      })
      .catch(function (err) {
        toast(tf('toast.unzipFail', { msg: (err && err.message) || '?' }), 4200);
      });
  }

  function doImportQueue() {
    if (!importQueue.length) { toast(t('toast.queueEmpty')); return; }
    var opts = currentOpts();
    var names = importQueue.map(function (x) { return x.name; });
    var conflicts = names.filter(function (n) {
      return state.decks.some(function (d) { return d.name === n; });
    }).length;
    var replace = 'ask';
    if (conflicts) {
      replace = window.confirm(tf('confirm.batchReplace', { n: conflicts })) ? 'yes' : 'no';
    }
    var total = importQueue.length;
    var okCount = 0;
    var idx = 0;
    closeModal();
    toast(tf('toast.importing', { n: total }), 3000);

    function next() {
      if (idx >= total) {
        scheduleSave();
        renderHome();
        toast(tf('toast.importDone', { ok: okCount, total: total }), 3000);
        return;
      }
      var item = importQueue[idx++];
      var p = item.text != null ? Promise.resolve(item.text) : readFileText(item.file);
      p.then(function (text) {
        if (importText(item.name, text, opts, { silent: true, replace: replace, source: item.source || '' })) okCount++;
      }).catch(function () {
        toast(tf('toast.readFail', { name: item.name }));
      }).then(function () {
        setTimeout(next, 20);
      });
    }
    next();
  }

  function removeQueueItem(idx) {
    importQueue.splice(idx, 1);
    renderImportQueue();
  }

  function openPasteModal() {
    openModal(
      '<h3>' + t('paste.title') + '</h3>' +
      '<div class="field"><label>' + t('paste.name') + '</label><input id="pasteName" type="text" value="' + ESC(t('paste.defaultName')) + '" maxlength="60"></div>' +
      '<div class="field"><label>' + t('label.mode') + '</label><select id="pasteMode">' + modeOptions(state.settings.mode) + '</select></div>' +
      '<div class="field"><label>' + t('label.qstyle') + '</label><select id="pasteQstyle">' + qstyleOptions(state.settings.qstyle) + '</select></div>' +
      '<div class="field"><label>' + t('label.gran') + '</label><select id="pasteGran">' + granOptions(state.settings.gran) + '</select></div>' +
      '<textarea id="pasteText" placeholder="' + ESC(t('paste.ph')) + '" style="min-height:180px"></textarea>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="do-paste">' + t('btn.ok') + '</button>' +
      '</div>' +
      '<p class="modal-note">' + t('paste.note') + '</p>'
    );
  }

  function qstyleOptions(selected) {
    return Object.keys(QSTYLE_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + t(QSTYLE_LABELS[k]) + '</option>';
    }).join('');
  }

  function modeOptions(selected) {
    var html = '';
    Object.keys(MODE_LABELS).forEach(function (k) {
      html += '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + t(MODE_LABELS[k]) + '</option>';
    });
    return html;
  }

  function granOptions(selected) {
    var keys = ['fine', 'mid', 'coarse'];
    return keys.map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + t('gran.' + k) + '</option>';
    }).join('');
  }

  function doPaste() {
    var name = $('#pasteName') ? $('#pasteName').value.trim() : '';
    var text = $('#pasteText') ? $('#pasteText').value : '';
    var mode = $('#pasteMode') ? $('#pasteMode').value : 'auto';
    var qstyle = $('#pasteQstyle') ? $('#pasteQstyle').value : state.settings.qstyle;
    var gran = $('#pasteGran') ? $('#pasteGran').value : 'mid';
    if (!text || !text.trim()) { toast(t('toast.pasteEmpty')); return; }
    if (importText(name || t('paste.defaultName'), text, { mode: mode, gran: gran, qstyle: qstyle })) closeModal();
  }

  function loadDemo() {
    importText('示例 · 计算机网络与操作系统', SAMPLE_MD, { mode: 'auto', gran: 'mid', qstyle: 'prompt' });
  }

  /* ---------- AI 提炼（可选；无服务器，用户自己填 API） ---------- */

  function aiErrorHelp(err) {
    var msg = String((err && err.message) || err || 'Error');
    if (/CORS|跨域|网络|Failed to fetch/i.test(msg)) {
      return msg + '\n' + t('ai.corsHelp');
    }
    return msg;
  }

  function providerEndpoint(p) {
    var base = (p.base || '').trim().replace(/\/+$/, '');
    if (p.protocol === 'anthropic') {
      // Anthropic Messages API：base 为 https://api.anthropic.com，或已含 /v1
      if (/\/v1$/.test(base)) return base + '/messages';
      return base + '/v1/messages';
    }
    if (/\/chat\/completions$/i.test(base)) return base;
    return base + '/chat/completions';
  }

  function aiChat(messages, maxTokens) {
    var p = activeProvider();
    if (!p) return Promise.reject(new Error(t('ai.noneEnabled')));
    if (!p.base) return Promise.reject(new Error(t('ai.noBase')));
    if (!p.model) return Promise.reject(new Error(t('ai.noModel')));
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (controller) timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT);
    var url = providerEndpoint(p);
    var headers = { 'Content-Type': 'application/json' };
    var body;
    if (p.protocol === 'anthropic') {
      headers['x-api-key'] = p.key || '';
      headers['anthropic-version'] = '2023-06-01';
      // 允许浏览器直连 Anthropic API（CORS）
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      var sys = '';
      var msgs = [];
      messages.forEach(function (m) {
        if (m.role === 'system') sys += (sys ? '\n' : '') + m.content;
        else msgs.push({ role: m.role, content: m.content });
      });
      body = JSON.stringify({ model: p.model, max_tokens: maxTokens || 1500, system: sys || undefined, messages: msgs });
    } else {
      if (p.key) headers.Authorization = 'Bearer ' + p.key;
      body = JSON.stringify({
        model: p.model,
        temperature: 0.2,
        max_tokens: maxTokens || 1500,
        messages: messages
      });
    }
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: body,
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) { data = null; }
        if (!res.ok) {
          var msg = (data && data.error && (data.error.message || data.error)) || String(text).slice(0, 200);
          throw new Error('HTTP ' + res.status + ': ' + msg);
        }
        if (!data) throw new Error(t('ai.notJson') + String(text).slice(0, 120));
        var content = '';
        if (p.protocol === 'anthropic') {
          content = (data.content || []).filter(function (c) { return c && c.type === 'text'; })
            .map(function (c) { return c.text || ''; }).join('\n');
        } else {
          content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        }
        if (!content) throw new Error(t('ai.noContent'));
        return content;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error(tf('ai.timeout', { s: AI_TIMEOUT / 1000 }));
      if (err instanceof TypeError) throw new Error(t('ai.netFail'));
      throw err;
    }).then(function (v) {
      if (timer) clearTimeout(timer);
      return v;
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }

  function testProviderModal(providerId) {
    var p = findProvider(providerId);
    if (!p) return;
    if (!p.base || !p.model) { toast(t('ai.needConfig')); return; }
    openModal(
      '<h3>' + t('ai.testTitle') + ' · ' + ESC(p.name) + '</h3>' +
      '<div class="ai-out" id="aiTestOut">' + tf('ai.testing', { s: AI_TIMEOUT / 1000 }) + '</div>' +
      '<div class="modal-actions"><button class="btn" data-act="close-modal">' + t('btn.close') + '</button></div>'
    );
    // 临时以该供应商发起一次最小请求（不影响「当前使用」选择）
    var prev = aiState().activeId;
    aiState().activeId = p.id;
    aiChat([{ role: 'user', content: '只回复两个字：可用' }], 32).then(function (text) {
      aiState().activeId = prev;
      var out = $('#aiTestOut');
      if (out) out.innerHTML = '<b class="ok">' + t('ai.testOk') + '</b><br>' + ESC(t('ai.modelReply')) + ESC(String(text).slice(0, 120));
    }).catch(function (err) {
      aiState().activeId = prev;
      var out = $('#aiTestOut');
      if (out) out.innerHTML = '<b class="todo">' + t('ai.testFail') + '</b><br>' + ESC(aiErrorHelp(err)).replace(/\n/g, '<br>');
    });
  }

  /* ---------- 供应商管理 UI（设置页） ---------- */

  function providerCardHtml(p) {
    var modelOpts = (p.models.length ? p.models : [p.model || '']).map(function (m) {
      return '<option value="' + ESC(m) + '"' + (m === p.model ? ' selected' : '') + '>' + ESC(m) + '</option>';
    }).join('');
    return '<div class="ai-p' + (p.enabled ? '' : ' disabled') + '" data-pid="' + ESC(p.id) + '">' +
      '<div class="ai-p-head">' +
        '<input class="ai-p-name" data-field="name" value="' + ESC(p.name) + '" maxlength="40">' +
        (p.preset ? '<span class="ai-p-tag">' + t('ai.presetTag') + '</span>' : '') +
        '<label class="switch"><input type="checkbox" data-field="enabled"' + (p.enabled ? ' checked' : '') + '><i></i></label>' +
      '</div>' +
      '<div class="field"><label>' + t('label.aiBase') + '</label>' +
        '<input type="text" data-field="base" value="' + ESC(p.base) + '" placeholder="https://..." autocomplete="off"></div>' +
      '<div class="field"><label>' + t('label.aiKey') + '</label>' +
        '<input type="password" data-field="key" value="' + ESC(p.key) + '" placeholder="sk-..." autocomplete="off"></div>' +
      '<div class="field"><label>' + t('ai.models') + '</label>' +
        '<input type="text" data-field="models" value="' + ESC(p.models.join(', ')) + '" placeholder="model-a, model-b" autocomplete="off"></div>' +
      '<div class="field"><label>' + t('ai.model') + '</label>' +
        '<select data-field="model">' + modelOpts + '</select></div>' +
      '<div class="ai-p-actions">' +
        '<button class="btn sm" data-act="ai-test-provider" data-pid="' + ESC(p.id) + '">' + t('btn.aiTest') + '</button>' +
        '<button class="btn sm danger" data-act="ai-del-provider" data-pid="' + ESC(p.id) + '">' + t('btn.delete') + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderAiProviders() {
    var wrap = $('#aiProviderList');
    if (!wrap) return;
    var ai = aiState();
    var sel = $('#aiActive');
    var enabled = ai.providers.filter(function (p) { return p.enabled; });
    if (sel) {
      var opts;
      if (enabled.length) {
        opts = enabled.map(function (p) {
          return '<option value="' + ESC(p.id) + '"' + (p.id === ai.activeId ? ' selected' : '') + '>' +
            ESC(p.name + ' · ' + (p.model || '-')) + '</option>';
        }).join('');
      } else {
        opts = '<option value="">' + t('ai.noneEnabled') + '</option>';
      }
      sel.innerHTML = opts;
      sel.disabled = !enabled.length;
    }
    wrap.innerHTML = ai.providers.map(providerCardHtml).join('');
  }

  function openAiQuick() {
    var ai = aiState();
    var enabled = ai.providers.filter(function (p) { return p.enabled && p.model; });
    var body;
    if (!enabled.length) {
      body = '<p class="modal-note">' + t('ai.noneEnabled') + '</p>' +
        '<div class="modal-actions">' +
          '<button class="btn primary" data-act="ai-manage">' + t('ai.goSettings') + '</button>' +
          '<button class="btn" data-act="close-modal">' + t('btn.close') + '</button>' +
        '</div>';
    } else {
      var rows = enabled.map(function (p) {
        return p.models.map(function (m) {
          var isCur = p.id === ai.activeId && m === p.model;
          return '<button class="ai-q-row' + (isCur ? ' on' : '') + '" data-act="ai-quick-pick"' +
            ' data-pid="' + ESC(p.id) + '" data-model="' + ESC(m) + '">' +
            '<span class="ai-q-dot"></span><span class="ai-q-name">' + ESC(p.name) + '</span>' +
            '<span class="ai-q-model">' + ESC(m) + '</span></button>';
        }).join('');
      }).join('');
      body = '<div class="ai-q-list">' + rows + '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn" data-act="ai-manage">' + t('ai.manage') + '</button>' +
          '<button class="btn" data-act="close-modal">' + t('btn.close') + '</button>' +
        '</div>';
    }
    openModal('<h3>' + t('ai.quickTitle') + '</h3>' + body);
  }

  function pickAiQuick(pid, model) {
    var p = findProvider(pid);
    if (!p || !p.enabled) return;
    var ai = aiState();
    ai.activeId = pid;
    if (p.models.indexOf(model) >= 0) p.model = model;
    scheduleSave();
    closeModal();
    renderHome();
    toast(tf('ai.using', { name: p.name, model: p.model }));
  }

  function openAddProviderModal() {
    var ai = aiState();
    var added = {};
    ai.providers.forEach(function (p) { added[p.id] = true; });
    var avail = AI_PRESETS.filter(function (ps) { return !added[ps.id]; });
    var rows = avail.map(function (ps) {
      return '<button class="ai-q-row" data-act="ai-add-preset" data-pid="' + ESC(ps.id) + '">' +
        '<span class="ai-q-name">' + ESC(ps.name) + '</span>' +
        '<span class="ai-q-model">' + ESC(String(ps.base).replace(/^https?:\/\//, '')) + '</span></button>';
    }).join('');
    openModal(
      '<h3>' + t('ai.addTitle') + '</h3>' +
      '<div class="ai-q-list">' + rows +
        '<button class="ai-q-row" data-act="ai-add-custom">' +
          '<span class="ai-q-name">' + t('ai.addCustom') + '</span></button>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn" data-act="close-modal">' + t('btn.close') + '</button></div>'
    );
  }

  function addPreset(presetId) {
    var ps = null;
    AI_PRESETS.forEach(function (x) { if (x.id === presetId) ps = x; });
    if (!ps || findProvider(ps.id)) return;
    var ai = aiState();
    var hadEnabled = ai.providers.some(function (p) { return p.enabled; });
    ai.providers.push({
      id: ps.id, name: ps.name, base: ps.base, key: '',
      models: ps.models.slice(), model: ps.models[0] || '',
      enabled: true, protocol: ps.protocol, preset: true
    });
    if (!hadEnabled) ai.activeId = ps.id;
    scheduleSave();
    closeModal();
    renderAiProviders();
  }

  function addCustomProvider() {
    var ai = aiState();
    var p = {
      id: uid('p'), name: t('ai.customName'), base: '', key: '',
      models: [], model: '', enabled: true, protocol: 'openai', preset: false
    };
    ai.providers.push(p);
    ai.activeId = p.id;
    scheduleSave();
    closeModal();
    renderAiProviders();
  }

  function deleteProvider(providerId) {
    var ai = aiState();
    var p = findProvider(providerId);
    if (!p) return;
    if (!window.confirm(tf('confirm.deleteProvider', { name: p.name }))) return;
    ai.providers = ai.providers.filter(function (x) { return x.id !== providerId; });
    if (p.preset && ai.removed.indexOf(providerId) < 0) ai.removed.push(providerId);
    scheduleSave();
    renderAiProviders();
  }

  function onProviderField(providerId, field, el) {
    var p = findProvider(providerId);
    if (!p) return;
    if (field === 'enabled') {
      p.enabled = el.checked;
      // 重新计算「当前使用」并刷新整块 UI
      var ai = aiState();
      var active = findProvider(ai.activeId);
      if (!active || (!active.enabled && p.enabled)) ai.activeId = p.id;
      scheduleSave();
      renderAiProviders();
      return;
    }
    if (field === 'models') {
      p.models = el.value.split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20);
      if (p.models.indexOf(p.model) < 0) p.model = p.models[0] || '';
      scheduleSave();
      renderAiProviders();
      return;
    }
    if (field === 'model') {
      p.model = el.value;
      scheduleSave();
      renderAiProviders();
      return;
    }
    if (field === 'base') p.base = el.value.trim();
    else if (field === 'key') p.key = el.value;
    else if (field === 'name') p.name = el.value.trim().slice(0, 40) || t('ai.customName');
    scheduleSave();
  }

  var aiRun = { active: false, cancel: false };

  function openAiModal(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    openModal(
      '<h3>' + t('ai.title') + '</h3>' +
      '<p class="modal-note">' + t('ai.desc') + '</p>' +
      (aiReady() ? '' : '<p class="modal-note warn">' + t('ai.notConfigured') + '</p>') +
      '<div class="ai-out" id="aiOut">' + ESC(d.name) + ' · ' + tf('ai.cardCount', { n: d.cards.length }) + ' · '
        + (aiReady()
          ? ESC(tf('ai.using', { name: (activeProvider() || {}).name || '-', model: (activeProvider() || {}).model || '-' }))
          : t('ai.noneEnabled')) + '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.close') + '</button>' +
        '<button class="btn primary" data-act="ai-start" data-deck="' + d.id + '"' + (aiReady() ? '' : ' disabled') + '>' + t('ai.start') + '</button>' +
      '</div>'
    );
    modalPayload = { deckId: d.id };
  }

  function parseAiQuestions(content) {
    var text = String(content || '');
    var arr = null;
    var m = /\[[\s\S]*\]/.exec(text);
    if (m) {
      try { arr = JSON.parse(m[0]); } catch (e) { arr = null; }
    }
    if (!Array.isArray(arr)) {
      var om = /\{[\s\S]*\}/.exec(text);
      if (om) {
        try {
          var obj = JSON.parse(om[0]);
          if (obj && Array.isArray(obj.questions)) arr = obj.questions;
        } catch (e2) { arr = null; }
      }
    }
    if (!Array.isArray(arr)) return [];
    return arr.map(function (item) {
      if (typeof item === 'string') return { q: item };
      if (!item || typeof item !== 'object') return null;
      return {
        idx: item.idx != null ? item.idx : (item.i != null ? item.i : item.index),
        q: item.q || item.question || item.问题 || ''
      };
    }).filter(function (x) { return x && x.q; });
  }

  function startAiRefine() {
    var deckId = modalPayload && modalPayload.deckId;
    var d = findDeck(deckId);
    if (!d) return;
    if (aiRun.active) { toast(t('ai.busy')); return; }
    if (!aiReady()) { toast(t('ai.needConfig')); return; }

    var cards = d.cards;
    var batches = [];
    var cur = [];
    var curLen = 0;
    cards.forEach(function (c, i) {
      var itemLen = (c.title + c.answer).length;
      if (cur.length && curLen + itemLen > AI_BATCH_CHARS) { batches.push(cur); cur = []; curLen = 0; }
      cur.push({ i: i, title: c.title, answer: c.answer.slice(0, 2500) });
      curLen += itemLen;
    });
    if (cur.length) batches.push(cur);

    aiRun = { active: true, cancel: false, done: 0, total: cards.length };
    var changed = 0;
    var errors = [];

    function progress() {
      var out = $('#aiOut');
      if (out) out.innerHTML = tf('ai.progress', { done: aiRun.done, total: aiRun.total, batches: batches.length });
    }

    function runBatch(b) {
      progress();
      var payload = b.map(function (item) { return { idx: item.i, title: item.title, answer: item.answer }; });
      var sys = '你是资深技术面试官，负责把技术笔记整理成自测问题。要求：' +
        '1) 每个条目给出一句自然、具体、可用来自测的问题；' +
        '2) 问题必须能从给定答案回答出来，不得编造答案里没有的内容；' +
        '3) 标题本身已经是好问题时可以沿用或轻微润色；' +
        '4) 只输出 JSON，不要任何解释，格式：{"questions":[{"idx":数字,"q":"问题"}]}';
      return aiChat([
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(payload) }
      ], 2000).then(function (content) {
        var list = parseAiQuestions(content);
        if (!list.length) throw new Error(t('ai.badFormat'));
        var noIdx = list.every(function (x) { return x.idx == null; });
        list.forEach(function (item, k) {
          var targetIdx = noIdx ? (b[k] ? b[k].i : null) : Number(item.idx);
          if (targetIdx == null || !cards[targetIdx]) return;
          var q = String(item.q || '').trim();
          if (!q) return;
          cards[targetIdx].question = q;
          changed++;
        });
        aiRun.done += b.length;
      }).catch(function (err) {
        errors.push(aiErrorHelp(err));
        aiRun.done += b.length;
      });
    }

    function nextBatch(k) {
      if (aiRun.cancel || k >= batches.length) { finish(); return; }
      runBatch(batches[k]).then(function () {
        setTimeout(function () { nextBatch(k + 1); }, 60);
      });
    }

    function finish() {
      aiRun.active = false;
      scheduleSave();
      renderHome();
      var out = $('#aiOut');
      var msg = errors.length
        ? tf('ai.doneFail', { n: changed, m: errors.length })
        : tf('ai.done', { n: changed });
      if (out) {
        out.innerHTML = '<b class="ok">' + ESC(msg) + '</b>' +
          (errors.length ? '<br><span class="warn">' + ESC(errors[0]).replace(/\n/g, '<br>') + '</span>' : '');
      }
      toast(msg, 3000);
    }

    nextBatch(0);
  }

  function importCardsJson(text) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (!obj) { toast(t('toast.badJson')); return; }
    var decks = [];
    if (Array.isArray(obj)) decks = obj;
    else if (Array.isArray(obj.decks)) decks = obj.decks;
    else if (Array.isArray(obj.cards)) decks = [{ name: obj.name || t('deck.aiDefault'), cards: obj.cards }];
    if (!decks.length) { toast(t('toast.noDecks')); return; }
    var added = 0;
    decks.forEach(function (srcDeck) {
      if (!srcDeck || !Array.isArray(srcDeck.cards) || !srcDeck.cards.length) return;
      var used = Object.create(null);
      var cards = [];
      srcDeck.cards.forEach(function (c) {
        if (!c) return;
        var title = String(c.title || c.q || c.question || t('card.untitled')).trim();
        var question = String(c.question || c.q || '').trim();
        var answer = String(c.answer || c.a || '');
        if (!answer.trim()) return;
        var id = 'c' + Core.hash32(title + '|' + question + '|' + answer);
        if (used[id]) { used[id]++; id = id + '-' + used[id]; } else { used[id] = 1; }
        cards.push({
          id: id, title: title, question: question, answer: answer,
          path: Array.isArray(c.path) ? c.path.filter(function (x) { return typeof x === 'string'; }) : []
        });
      });
      if (!cards.length) return;
      var name = String(srcDeck.name || srcDeck.title || t('deck.aiDefault')).replace(/\.(md|markdown|txt|json)$/i, '').trim() || t('deck.aiDefault');
      var deck = {
        id: 'd' + Core.hash32(name + '|' + cards.length + '|' + Date.now()),
        name: name,
        title: srcDeck.title || name,
        createdAt: Date.now(),
        mode: 'ai',
        qstyle: 'prompt',
        raw: '',
        source: srcDeck.source || t('deck.aiDefault'),
        cards: cards
      };
      var existIdx = -1;
      for (var i = 0; i < state.decks.length; i++) if (state.decks[i].name === name) { existIdx = i; break; }
      if (existIdx >= 0) state.decks[existIdx] = deck; else state.decks.push(deck);
      added += cards.length;
    });
    if (!added) { toast(t('toast.nothingToImport')); return; }
    scheduleSave();
    renderHome();
    toast(tf('toast.aiImported', { n: added }), 2800);
  }

  /* ============================== 复习 ============================== */

  function collectReviewItems(deckIds, filter) {
    var out = [];
    deckIds.forEach(function (id) {
      var d = findDeck(id);
      if (!d) return;
      d.cards.forEach(function (c) {
        if (filter === 'todo' && statusOf(c.id) === 'known') return;
        out.push({ card: c, deckId: id, deckName: d.name });
      });
    });
    return out;
  }

  function startReview(deckIds, filter) {
    var items = collectReviewItems(deckIds, filter || 'all');
    if (!items.length) {
      toast(filter === 'todo' ? t('review.noTodo') : t('review.noCards'));
      return;
    }
    shuffle(items);
    review = {
      deckIds: deckIds.slice(),
      filter: filter || 'all',
      deckName: deckIds.length === 1
        ? (findDeck(deckIds[0]) || {}).name || t('deck.defaultName')
        : tf('review.allDecks', { n: deckIds.length }),
      phase: 1,
      queue: items.slice(),
      round2: [],
      total: items.length,
      rated: 0,
      okCount: 0,
      fuzzyCount: 0,
      badCount: 0,
      current: null,
      revealed: false
    };
    $('#rvSummary').classList.add('hidden');
    $('#rvCard').classList.remove('hidden');
    $('#rvAnswer').innerHTML = '';
    showView('review');
    nextCard();
  }

  function currentRoundTotal() {
    return review ? review.total : 0;
  }

  function nextCard() {
    if (!review) return;
    if (!review.queue.length) {
      if (review.round2.length) {
        review.phase = 2;
        review.queue = shuffle(review.round2);
        review.round2 = [];
        review.total = review.queue.length;
        review.rated = 0;
        toast(tf('review.round2', { n: review.total }), 2400);
      } else {
        finishReview();
        return;
      }
    }
    review.current = review.queue.shift();
    review.revealed = false;
    renderCard();
  }

  function renderCard() {
    if (!review || !review.current) return;
    var card = review.current.card;
    var q = review.current;

    $('#rvDeck').textContent = review.deckName + (review.phase > 1 ? ' · ' + t('review.round2Label') : '');
    var left = review.total - review.rated;
    $('#rvProg').textContent = tf('review.progress', { rated: review.rated, total: review.total, left: left });
    $('#rvBar').style.width = (currentRoundTotal() ? Math.min(100, (review.rated / currentRoundTotal()) * 100) : 0) + '%';

    var pathParts = [];
    if (review.deckIds.length > 1) pathParts.push(q.deckName);
    (card.path || []).forEach(function (p) { pathParts.push(p); });
    $('#rvPath').textContent = pathParts.join('  /  ');
    $('#rvTitle').textContent = card.title;

    var qText = (card.question || '').trim();
    var qEl = $('#rvQuestion');
    if (qText) {
      qEl.innerHTML = qText.indexOf('\n') >= 0 ? resolveImgSrc(Core.renderMarkdown(qText)) : Core.renderInline(qText);
      qEl.classList.remove('hidden');
    } else {
      qEl.innerHTML = '';
      qEl.classList.add('hidden');
    }

    $('#rvAnswer').innerHTML = '';
    $('#rvAnswer').classList.add('hidden');
    $('#rvCard').classList.remove('revealed', 'swipe-left', 'swipe-right');
    $('#btnShow').classList.remove('hidden');
    $('#rateRow').classList.add('hidden');
    $('#rvSummary').classList.add('hidden');
    $('#rvCard').classList.remove('hidden');
  }

  function showAnswer() {
    if (!review || !review.current || review.revealed) return;
    review.revealed = true;
    var card = review.current.card;
    var ans = $('#rvAnswer');
    ans.innerHTML = renderAnswerHtml(card.answer, findDeck(review.current.deckId));
    ans.classList.remove('hidden');
    $('#rvCard').classList.add('revealed');
    $('#btnShow').classList.add('hidden');
    $('#rateRow').classList.remove('hidden');
  }

  function rate(kind) {
    if (!review || !review.current || !review.revealed) return;
    var item = review.current;
    var st = ensureStat(item.card.id);
    st.n = (st.n || 0) + 1;
    st.last = Date.now();
    if (kind === 'ok') {
      st.ok = (st.ok || 0) + 1;
      st.s = 'known';
      review.okCount++;
    } else {
      st.bad = (st.bad || 0) + 1;
      st.s = 'learning';
      if (kind === 'fuzzy') review.fuzzyCount++;
      else review.badCount++;
      if (review.phase === 1) review.round2.push(item);
    }
    review.rated++;
    bumpDaily();
    scheduleSave();
    review.current = null;
    nextCard();
  }

  function finishReview() {
    $('#rvCard').classList.add('hidden');
    $('#btnShow').classList.add('hidden');
    $('#rateRow').classList.add('hidden');
    $('#rvBar').style.width = '100%';
    var s = $('#rvSummary');
    s.classList.remove('hidden');
    s.innerHTML =
      '<div class="big-emoji">🎉</div>' +
      '<h3>' + t('review.done') + '</h3>' +
      '<p>' + ESC(review.deckName) + '</p>' +
      '<div class="sum-grid">' +
        '<div class="sum-item g"><b>' + review.okCount + '</b><span>' + t('rate.ok') + '</span></div>' +
        '<div class="sum-item a"><b>' + review.fuzzyCount + '</b><span>' + t('rate.fuzzy') + '</span></div>' +
        '<div class="sum-item r"><b>' + review.badCount + '</b><span>' + t('rate.bad') + '</span></div>' +
      '</div>' +
      '<div class="sum-actions">' +
        '<button class="btn primary big" data-act="again">' + t('review.again') + '</button>' +
        '<button class="btn big" data-act="again-todo">' + t('review.againTodo') + '</button>' +
        '<button class="btn big ghost" data-act="back-home">' + t('review.backList') + '</button>' +
      '</div>';
    $('#rvProg').textContent = t('review.finished');
    review.current = null;
    review.revealed = false;
  }

  /* ============================== 浏览 / 编辑 ============================== */

  function openBrowse(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    browse.deckId = deckId;
    browse.q = '';
    $('#browseDeck').textContent = d.name;
    $('#browseMeta').textContent = tf('browse.meta', { n: d.cards.length, k: knownOf(d) });
    $('#searchInput').value = '';
    renderBrowse();
    showView('browse');
  }

  function renderBrowse() {
    var d = findDeck(browse.deckId);
    if (!d) { goHome(); return; }
    var q = (browse.q || '').trim().toLowerCase();
    var list = d.cards.filter(function (c) {
      if (!q) return true;
      return (c.title + ' ' + (c.question || '') + ' ' + c.answer).toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) {
      $('#cardList').innerHTML = '<p class="muted" style="text-align:center;padding:34px 0">' + t('browse.noMatch') + '</p>';
      return;
    }
    $('#cardList').innerHTML = list.map(function (c) {
      var s = statusOf(c.id);
      var label = s === 'known' ? t('card.known') : (s === 'learning' ? t('card.learning') : t('card.new'));
      return '' +
        '<div class="citem" data-act="open-card" data-deck="' + d.id + '" data-card="' + ESC(c.id) + '">' +
          '<span class="dot ' + s + '" title="' + label + '"></span>' +
          '<div class="citem-main">' +
            '<div class="citem-title">' + ESC(c.title) + '</div>' +
            '<div class="citem-snip">' + ESC(Core.plainText(c.answer).slice(0, 80)) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function openCardModal() {
    var d = findDeck(browse.deckId);
    if (!d) return;
    var card = null;
    for (var i = 0; i < d.cards.length; i++) if (d.cards[i].id === browse.cardId) { card = d.cards[i]; break; }
    if (!card) return;
    openModal(
      '<h3>' + t('card.editTitle') + '</h3>' +
      '<div class="md-view" style="max-height:32vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:10px 12px">' +
        renderAnswerHtml(card.answer, d) +
      '</div>' +
      '<div class="field"><label>' + t('card.title') + '</label><input id="editTitle" type="text" value="' + ESC(card.title) + '"></div>' +
      '<div class="field" style="display:block"><label style="display:block;margin-bottom:6px">' + t('card.question') + '</label>' +
        '<textarea id="editQuestion" style="min-height:64px">' + ESC(card.question || '') + '</textarea></div>' +
      '<div class="field" style="display:block"><label style="display:block;margin-bottom:6px">' + t('card.answer') + '</label>' +
        '<textarea id="editAnswer" style="min-height:150px">' + ESC(card.answer) + '</textarea></div>' +
      '<div class="modal-actions">' +
        '<button class="btn danger" data-act="delete-card">' + t('btn.delete') + '</button>' +
        '<button class="btn" data-act="close-modal">' + t('btn.close') + '</button>' +
        '<button class="btn primary" data-act="save-card">' + t('btn.save') + '</button>' +
      '</div>' +
      '<p class="modal-note">' + t('card.editNote') + '</p>'
    );
    modalPayload = { deckId: d.id, cardId: browse.cardId };
  }

  function saveCard() {
    if (!modalPayload) return;
    var d = findDeck(modalPayload.deckId);
    if (!d) return;
    var card = null;
    for (var i = 0; i < d.cards.length; i++) if (d.cards[i].id === modalPayload.cardId) { card = d.cards[i]; break; }
    if (!card) return;
    var title = $('#editTitle').value.trim();
    var question = $('#editQuestion').value.trim();
    var answer = $('#editAnswer').value;
    if (!answer.trim()) { toast(t('toast.answerEmpty')); return; }
    card.title = title || Core.plainText(question || answer).slice(0, 40) || t('card.untitled');
    card.question = question;
    card.answer = answer.replace(/\s+$/, '');
    scheduleSave();
    closeModal();
    renderBrowse();
    toast(t('toast.saved'));
  }

  function deleteCard() {
    if (!modalPayload) return;
    var d = findDeck(modalPayload.deckId);
    if (!d) return;
    if (!window.confirm(t('confirm.deleteCard'))) return;
    d.cards = d.cards.filter(function (c) { return c.id !== modalPayload.cardId; });
    if (!d.cards.length) {
      state.decks = state.decks.filter(function (x) { return x.id !== d.id; });
    }
    scheduleSave();
    closeModal();
    goHome();
    toast(t('toast.deleted'));
  }

  /* ============================== 内置题库（随 html 一起打包） ============================== */

  function normalizeBundledCard(c) {
    var title = String(c.title || '').trim() || t('card.untitled');
    var question = String(c.question || '').trim();
    var answer = String(c.answer || '');
    var path = Array.isArray(c.path) ? c.path.filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
    var id = 'c' + Core.hash32(title + '|' + question + '|' + answer);
    return { id: id, title: title, question: question, answer: answer, path: path };
  }

  function buildBundledDeck(bd) {
    var used = Object.create(null);
    var cards = [];
    (bd.cards || []).forEach(function (raw) {
      var c = normalizeBundledCard(raw);
      if (!c.answer.trim()) return;
      if (used[c.id]) { used[c.id]++; c.id = c.id + '-' + used[c.id]; } else { used[c.id] = 1; }
      cards.push(c);
    });
    var name = String(bd.name || t('src.bundled')).trim();
    return {
      id: 'd' + Core.hash32('bundled|' + name),
      name: name,
      title: name,
      createdAt: Date.now(),
      mode: 'ai',
      qstyle: 'prompt',
      raw: '',
      source: String(bd.source || t('src.bundled')),
      bundled: true,
      cards: cards
    };
  }

  function seedBundledDecks(force) {
    var b = window.MDReviewBundledDecks;
    if (!b || !Array.isArray(b.decks) || !b.decks.length) return 0;
    if (!force && state.settings.bundledVersion === b.version) return 0;
    var added = 0;
    b.decks.forEach(function (bd) {
      var deck = buildBundledDeck(bd);
      if (!deck.cards.length) return;
      var idx = -1;
      for (var i = 0; i < state.decks.length; i++) {
        if (state.decks[i].name === deck.name) { idx = i; break; }
      }
      if (idx >= 0) state.decks[idx] = deck; else state.decks.push(deck);
      added += deck.cards.length;
    });
    state.settings.bundledVersion = b.version;
    return added;
  }

  function restoreBundled() {
    var added = seedBundledDecks(true);
    if (!added) { toast(t('bundled.none')); return; }
    scheduleSave();
    renderHome();
    if ($('#view-manage').classList.contains('active')) renderManage();
    toast(tf('bundled.restored', { n: added }), 2600);
  }

  /* ============================== 分类速记 ============================== */

  function chapterOf(card) {
    return (card.path && card.path[0]) ? card.path[0] : t('quick.uncategorized');
  }

  function quickChapterNames(deck) {
    var names = [];
    deck.cards.forEach(function (c) {
      var ch = chapterOf(c);
      if (names.indexOf(ch) < 0) names.push(ch);
    });
    return names;
  }

  function openQuick(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    quick = { deckId: deckId, q: '', chapter: '', collapsed: {}, tocOpen: false, highlight: '' };
    if ($('#quickSearch')) $('#quickSearch').value = '';
    showView('quick');
    renderQuick();
  }

  function renderQuick() {
    var d = findDeck(quick.deckId);
    if (!d) { goHome(); return; }
    var q = (quick.q || '').trim().toLowerCase();
    var all = d.cards.filter(function (c) {
      if (!q) return true;
      return (c.title + ' ' + (c.question || '') + ' ' + c.answer).toLowerCase().indexOf(q) >= 0;
    });
    $('#quickDeck').textContent = d.name;
    $('#quickMeta').textContent = tf('quick.meta', { n: d.cards.length, c: quickChapterNames(d).length });

    var chapterNames = [];
    all.forEach(function (c) {
      var ch = chapterOf(c);
      if (chapterNames.indexOf(ch) < 0) chapterNames.push(ch);
    });
    $('#quickOutline').innerHTML =
      '<button class="chip ' + (!quick.chapter ? 'on' : '') + '" data-act="quick-chapter" data-ch="">' + tf('quick.all', { n: all.length }) + '</button>' +
      chapterNames.map(function (ch) {
        return '<button class="chip ' + (quick.chapter === ch ? 'on' : '') + '" data-act="quick-chapter" data-ch="' + ESC(ch) + '">' + ESC(ch) + '</button>';
      }).join('');

    // 题目目录（两级：章 → 题），点题直接跳到对应卡片
    var tocEl = $('#quickToc');
    if (tocEl) {
      if (!quick.tocOpen) {
        tocEl.classList.add('hidden');
        tocEl.innerHTML = '';
      } else {
        tocEl.classList.remove('hidden');
        var tocCh = [];
        all.forEach(function (c) {
          var ch = chapterOf(c);
          var g = null;
          for (var i = 0; i < tocCh.length; i++) if (tocCh[i].ch === ch) { g = tocCh[i]; break; }
          if (!g) { g = { ch: ch, cards: [] }; tocCh.push(g); }
          g.cards.push(c);
        });
        tocEl.innerHTML = '<div class="toc-head">' + tf('quick.tocHead', { n: all.length }) + '</div>' +
          tocCh.map(function (g) {
            return '<div class="toc-ch">' + ESC(g.ch) + ' <span>' + g.cards.length + '</span></div>' +
              '<ol class="toc-list">' + g.cards.map(function (c, idx) {
                var label = (c.title || c.question || t('card.untitled')).replace(/\s+/g, ' ').slice(0, 70);
                return '<li><button class="toc-item" data-act="quick-jump" data-ch="' + ESC(g.ch) + '" data-card="' + ESC(c.id) + '">' +
                  '<span class="toc-num">' + (idx + 1) + '</span><span class="toc-text">' + ESC(label) + '</span></button></li>';
              }).join('') + '</ol>';
          }).join('');
      }
    }

    var groups = [];
    all.forEach(function (c) {
      var ch = chapterOf(c);
      if (quick.chapter && ch !== quick.chapter) return;
      if (!groups.length || groups[groups.length - 1].ch !== ch) {
        groups.push({ ch: ch, cards: [c] });
      } else {
        groups[groups.length - 1].cards.push(c);
      }
    });

    if (!groups.length) {
      $('#quickBody').innerHTML = '<p class="muted" style="text-align:center;padding:34px 0">' + t('quick.noMatch') + '</p>';
      return;
    }

    $('#quickBody').innerHTML = groups.map(function (g) {
      var collapsed = !!quick.collapsed[g.ch];
      return '<section class="quick-group' + (collapsed ? ' collapsed' : '') + '">' +
        '<button class="quick-ch" data-act="quick-fold" data-ch="' + ESC(g.ch) + '">' +
          '<span class="quick-ch-name">' + ESC(g.ch) + '</span>' +
          '<span class="quick-ch-count">' + tf('quick.count', { n: g.cards.length }) + ' · ' + (collapsed ? t('quick.expand') : t('quick.collapse')) + '</span>' +
        '</button>' +
        '<div class="quick-items">' + g.cards.map(function (c) {
          var qText = (c.question || '').trim();
          var head = qText ? (c.title ? c.title + '　' : '') + qText : c.title;
          return '<article class="quick-card" id="qc-' + ESC(c.id) + '">' +
            '<h3 class="quick-q">' + ESC(head) + '</h3>' +
            '<div class="quick-a">' + renderAnswerHtml(c.answer, d) + '</div>' +
          '</article>';
        }).join('') + '</div>' +
      '</section>';
    }).join('');

    if (quick.highlight) {
      var hid = quick.highlight;
      quick.highlight = '';
      var target = document.getElementById('qc-' + hid);
      if (target) {
        target.classList.add('flash');
        if (target.scrollIntoView) {
          try { target.scrollIntoView({ block: 'center' }); } catch (e) { target.scrollIntoView(); }
        }
        setTimeout(function () { target.classList.remove('flash'); }, 1800);
      }
    }
  }

  function toggleQuickToc() {
    quick.tocOpen = !quick.tocOpen;
    renderQuick();
  }

  function quickJump(ch, cardId) {
    quick.chapter = ch || '';
    quick.collapsed = {};
    quick.highlight = cardId || '';
    quick.tocOpen = false;
    renderQuick();
  }

  function toggleQuickAll() {
    var d = findDeck(quick.deckId);
    if (!d) return;
    var names = quickChapterNames(d);
    var anyOpen = names.some(function (ch) { return !quick.collapsed[ch]; });
    var next = {};
    names.forEach(function (ch) { if (anyOpen) next[ch] = true; });
    quick.collapsed = next;
    renderQuick();
  }

  /* ============================== 笔记管理 ============================== */

  function openManage() {
    showView('manage');
    renderManage();
  }

  function renderManage() {
    var totalCards = 0;
    state.decks.forEach(function (d) { totalCards += d.cards.length; });
    $('#manageMeta').textContent = tf('manage.meta', { n: state.decks.length, c: totalCards });
    if (!state.decks.length) {
      $('#manageList').innerHTML = '<p class="muted" style="text-align:center;padding:34px 0">' + t('manage.empty') + '</p>';
      return;
    }
    $('#manageList').innerHTML = state.decks.map(function (d) {
      var n = d.cards.length;
      var k = knownOf(d);
      var src = d.source || (d.bundled ? t('src.bundled') : (d.mode === 'ai' ? t('src.ai') : t('src.local')));
      var when = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '';
      return '<div class="mdeck">' +
        '<div class="mdeck-top">' +
          '<div class="mdeck-name">' + ESC(d.name) + (d.bundled ? ' <span class="mdeck-tag">' + t('src.bundled') + '</span>' : '') + '</div>' +
          '<div class="mdeck-meta">' + n + ' · ' + tf('deck.knownOf', { k: k }) + ' · ' + ESC(String(src)).slice(0, 40) + (when ? ' · ' + when : '') + '</div>' +
        '</div>' +
        '<div class="mdeck-actions">' +
          '<button class="btn sm primary" data-act="quick" data-deck="' + d.id + '">' + t('deck.quick') + '</button>' +
          '<button class="btn sm" data-act="review" data-deck="' + d.id + '">' + t('deck.review') + '</button>' +
          '<button class="btn sm" data-act="manage-rename" data-deck="' + d.id + '">' + t('manage.rename') + '</button>' +
          '<button class="btn sm" data-act="manage-reset" data-deck="' + d.id + '">' + t('manage.reset') + '</button>' +
          '<button class="btn sm" data-act="export-deck" data-deck="' + d.id + '">' + t('deck.export') + '</button>' +
          '<button class="btn sm danger" data-act="delete-deck" data-deck="' + d.id + '">' + t('deck.delete') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openRenameModal(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    openModal(
      '<h3>' + t('rename.title') + '</h3>' +
      '<div class="field" style="display:block"><input id="renameInput" type="text" value="' + ESC(d.name) + '" maxlength="60" style="max-width:100%"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="do-rename" data-deck="' + d.id + '">' + t('btn.save') + '</button>' +
      '</div>' +
      '<p class="modal-note">' + t('rename.note') + '</p>'
    );
  }

  function doRename(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    var v = $('#renameInput') ? $('#renameInput').value.trim() : '';
    if (!v) { toast(t('toast.nameEmpty')); return; }
    d.name = v;
    scheduleSave();
    closeModal();
    if ($('#view-manage').classList.contains('active')) renderManage(); else renderHome();
    toast(t('toast.renamed'));
  }

  function resetDeckProgress(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    if (!window.confirm(tf('confirm.resetProgress', { name: d.name }))) return;
    d.cards.forEach(function (c) { delete state.stats[c.id]; });
    scheduleSave();
    if ($('#view-manage').classList.contains('active')) renderManage(); else renderHome();
    toast(t('toast.progressCleared'));
  }

  /* ============================== 备份 ============================== */

  // 备份文件不含 API Key（隐私：Key 只留在本机）
  function stripAiKeys(settings) {
    var c = JSON.parse(JSON.stringify(settings));
    if (c.ai && Array.isArray(c.ai.providers)) {
      c.ai.providers = c.ai.providers.map(function (p) {
        var o = {};
        for (var k in p) o[k] = p[k];
        o.key = '';
        return o;
      });
    }
    return c;
  }

  function backupJson(deckIds) {
    var payload = {
      app: 'md-review',
      version: 1,
      exportedAt: new Date().toISOString(),
      decks: deckIds
        ? state.decks.filter(function (d) { return deckIds.indexOf(d.id) >= 0; })
        : state.decks,
      stats: state.stats,
      daily: state.daily,
      settings: stripAiKeys(state.settings)
    };
    return JSON.stringify(payload, null, 2);
  }

  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  function showExport(json, filename) {
    var kb = (json.length / 1024).toFixed(1);
    openModal(
      '<h3>' + t('export.title') + '</h3>' +
      '<p class="modal-note">' + tf('export.note', { kb: kb }) + '</p>' +
      '<textarea readonly style="min-height:150px;font-size:12.5px">' + ESC(json) + '</textarea>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.close') + '</button>' +
        '<button class="btn" data-act="copy-json">' + t('export.copy') + '</button>' +
        '<button class="btn primary" data-act="download-json">' + t('export.download') + '</button>' +
      '</div>'
    );
    modalPayload = { json: json, filename: filename };
  }

  function downloadFile(filename, text) {
    // Android WebView 里没有浏览器下载通道，走原生桥直接写进「下载」目录
    if (window.AndroidSaver && typeof window.AndroidSaver.saveText === 'function') {
      try {
        var saved = window.AndroidSaver.saveText(filename, 'application/json', text);
        if (saved) {
          toast(tf('toast.savedToDownloads', { name: filename }), 3000);
          return;
        }
      } catch (e) { /* fallback to browser download */ }
    }
    try {
      var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1500);
      toast(t('toast.downloading'), 2600);
    } catch (e) {
      toast(t('toast.downloadFail'));
    }
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? t('toast.copied') : t('toast.copyFail'));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(t('toast.copied')); }, fallback);
    } else {
      fallback();
    }
  }

  function importBackup(text) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (!obj || !Array.isArray(obj.decks)) {
      toast(t('toast.badBackup'));
      return;
    }
    if (!window.confirm(t('confirm.importBackup'))) return;
    state = normalizeState(obj);
    pruneDaily();
    applyTheme();
    applyI18nStatic();
    flushSave();
    renderHome();
    toast(tf('toast.backupImported', { n: state.decks.length }), 2600);
  }

  /* ============================== 事件 ============================== */

  function onAction(act, el) {
    switch (act) {
      case 'open-import':
        openImportModal();
        break;
      case 'imp-pick':
        $('#fileInput').value = '';
        $('#fileInput').click();
        break;
      case 'imp-zip':
        $('#zipInput').value = '';
        $('#zipInput').click();
        break;
      case 'imp-dir':
        $('#dirInput').value = '';
        $('#dirInput').click();
        break;
      case 'imp-do':
        doImportQueue();
        break;
      case 'imp-remove':
        removeQueueItem(parseInt(el.getAttribute('data-idx'), 10));
        break;
      case 'ai-deck':
        openAiModal(el.getAttribute('data-deck'));
        break;
      case 'quick':
        openQuick(el.getAttribute('data-deck'));
        break;
      case 'open-manage':
        openManage();
        break;
      case 'open-settings':
        openSettings();
        break;
      case 'quick-chapter':
        quick.chapter = el.getAttribute('data-ch') || '';
        renderQuick();
        break;
      case 'quick-fold': {
        var fch = el.getAttribute('data-ch') || '';
        if (quick.collapsed[fch]) delete quick.collapsed[fch];
        else quick.collapsed[fch] = true;
        renderQuick();
        break;
      }
      case 'quick-toggle-all':
        toggleQuickAll();
        break;
      case 'quick-toc':
        toggleQuickToc();
        break;
      case 'quick-jump':
        quickJump(el.getAttribute('data-ch') || '', el.getAttribute('data-card') || '');
        break;
      case 'manage-rename':
        openRenameModal(el.getAttribute('data-deck'));
        break;
      case 'do-rename':
        doRename(el.getAttribute('data-deck'));
        break;
      case 'manage-reset':
        resetDeckProgress(el.getAttribute('data-deck'));
        break;
      case 'restore-bundled':
        restoreBundled();
        break;
      case 'ai-start':
        startAiRefine();
        break;
      case 'ai-quick':
        openAiQuick();
        break;
      case 'ai-quick-pick':
        pickAiQuick(el.getAttribute('data-pid'), el.getAttribute('data-model'));
        break;
      case 'ai-add':
        openAddProviderModal();
        break;
      case 'ai-add-preset':
        addPreset(el.getAttribute('data-pid'));
        break;
      case 'ai-add-custom':
        addCustomProvider();
        break;
      case 'ai-manage':
        closeModal();
        openSettings();
        break;
      case 'ai-test-provider':
        testProviderModal(el.getAttribute('data-pid'));
        break;
      case 'ai-del-provider':
        deleteProvider(el.getAttribute('data-pid'));
        break;
      case 'import-cards-json':
        $('#cardsJsonInput').value = '';
        $('#cardsJsonInput').click();
        break;
      case 'paste':
        openPasteModal();
        break;
      case 'demo':
        loadDemo();
        break;
      case 'review': {
        var deckId = el.getAttribute('data-deck');
        startReview([deckId], state.settings.filter);
        break;
      }
      case 'review-all': {
        var ids = state.decks.map(function (d) { return d.id; });
        if (ids.length) startReview(ids, state.settings.filter);
        break;
      }
      case 'browse':
        openBrowse(el.getAttribute('data-deck'));
        break;
      case 'open-card': {
        browse.deckId = el.getAttribute('data-deck');
        browse.cardId = el.getAttribute('data-card');
        openCardModal();
        break;
      }
      case 'save-card':
        saveCard();
        break;
      case 'delete-card':
        deleteCard();
        break;
      case 'delete-deck': {
        var id = el.getAttribute('data-deck');
        var d = findDeck(id);
        if (!d) break;
        if (!window.confirm(tf('confirm.deleteDeck', { name: d.name, n: d.cards.length }))) break;
        state.decks = state.decks.filter(function (x) { return x.id !== id; });
        scheduleSave();
        if ($('#view-manage').classList.contains('active')) { renderManage(); } else { renderHome(); }
        toast(t('toast.deleted'));
        break;
      }
      case 'export-deck': {
        var did = el.getAttribute('data-deck');
        var dd = findDeck(did);
        if (!dd) break;
        showExport(backupJson([did]), 'md-review-' + safeName(dd.name) + '-' + dateStamp() + '.json');
        break;
      }
      case 'export-all':
        if (!state.decks.length) { toast(t('toast.noNotes')); break; }
        showExport(backupJson(null), 'md-review-backup-' + dateStamp() + '.json');
        break;
      case 'import-json':
        $('#jsonInput').value = '';
        $('#jsonInput').click();
        break;
      case 'download-json':
        if (modalPayload && modalPayload.json) downloadFile(modalPayload.filename || 'backup.json', modalPayload.json);
        break;
      case 'copy-json':
        if (modalPayload && modalPayload.json) copyText(modalPayload.json);
        break;
      case 'do-paste':
        doPaste();
        break;
      case 'set-filter':
        state.settings.filter = el.getAttribute('data-filter') === 'todo' ? 'todo' : 'all';
        scheduleSave();
        renderHome();
        break;
      case 'show-answer':
        showAnswer();
        break;
      case 'rate':
        rate(el.getAttribute('data-rate'));
        break;
      case 'reshuffle':
        if (review) {
          shuffle(review.queue);
          toast(t('toast.reshuffled'));
          renderCard();
        }
        break;
      case 'again':
        if (review) startReview(review.deckIds, review.filter);
        break;
      case 'again-todo':
        if (review) startReview(review.deckIds, 'todo');
        break;
      case 'reset-progress': {
        var rid = browse.deckId;
        var rd = findDeck(rid);
        if (!rd) break;
        if (!window.confirm(tf('confirm.resetProgress', { name: rd.name }))) break;
        rd.cards.forEach(function (c) { delete state.stats[c.id]; });
        scheduleSave();
        renderBrowse();
        toast(t('toast.progressCleared'));
        break;
      }
      case 'back-home':
        goBack();
        break;
      case 'close-modal':
        closeModal();
        break;
      default:
        break;
    }
  }

  function safeName(s) {
    return String(s || 'notes').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  }

  /* ============================== 设置 ============================== */

  function openSettings() {
    showView('settings');
    if ($('#setTheme')) $('#setTheme').value = state.settings.theme || 'dark';
    if ($('#setLang')) $('#setLang').value = state.settings.lang || 'zh-Hans';
    renderAiProviders();
  }

  function onThemeChange(v) {
    state.settings.theme = THEMES.indexOf(v) >= 0 ? v : 'dark';
    applyTheme();
    scheduleSave();
    toast(t('toast.themeChanged'));
  }

  function onLangChange(v) {
    state.settings.lang = LANGS.indexOf(v) >= 0 ? v : 'zh-Hans';
    applyI18nStatic();
    scheduleSave();
    renderHome();
    renderAiProviders();
    if (review) renderCard();
    toast(t('toast.langChanged'));
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (el) {
        var act = el.getAttribute('data-act');
        if (act === 'show-answer' || act === 'rate') {
          // 由各自按钮处理，但统一走 onAction
        }
        onAction(act, el);
        return;
      }
      if (e.target.id === 'modal') closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (!$('#modal').classList.contains('hidden')) {
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (!$('#view-review').classList.contains('active') || !review) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!review.revealed) showAnswer();
        else rate('ok');
      } else if (e.key === '1') { rate('bad'); }
      else if (e.key === '2') { rate('fuzzy'); }
      else if (e.key === '3') { rate('ok'); }
      else if (e.key === 'Escape') { goBack(); }
    });

    $('#fileInput').addEventListener('change', function (e) {
      addQueueFiles(e.target.files);
      e.target.value = '';
    });

    $('#zipInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) addQueueZip(f);
      e.target.value = '';
    });

    $('#dirInput').addEventListener('change', function (e) {
      addQueueFiles(e.target.files);
      e.target.value = '';
    });

    $('#cardsJsonInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      readFileText(f).then(function (text) { importCardsJson(text); }).catch(function () { toast(t('toast.readFailGeneric')); });
      e.target.value = '';
    });

    $('#jsonInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      readFileText(f).then(function (text) { importBackup(text); }).catch(function () { toast(t('toast.readFailGeneric')); });
      e.target.value = '';
    });

    var searchTimer = null;
    $('#searchInput').addEventListener('input', function (e) {
      var v = e.target.value;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        browse.q = v;
        renderBrowse();
      }, 120);
    });

    var quickTimer = null;
    if ($('#quickSearch')) {
      $('#quickSearch').addEventListener('input', function (e) {
        var v = e.target.value;
        if (quickTimer) clearTimeout(quickTimer);
        quickTimer = setTimeout(function () {
          quick.q = v;
          renderQuick();
        }, 150);
      });
    }

    document.addEventListener('change', function (e) {
      if (e.target.id === 'setMode') {
        state.settings.mode = e.target.value;
        scheduleSave();
        toast(t('toast.modeChanged'));
      } else if (e.target.id === 'setGran') {
        state.settings.gran = e.target.value;
        scheduleSave();
        toast(t('toast.granChanged'));
      } else if (e.target.id === 'setQstyle') {
        state.settings.qstyle = e.target.value;
        scheduleSave();
        toast(t('toast.qstyleChanged'));
      } else if (e.target.id === 'setTheme') {
        onThemeChange(e.target.value);
      } else if (e.target.id === 'setLang') {
        onLangChange(e.target.value);
      }
    });

    // AI 供应商：字段修改（事件委托，重渲染后依然有效）
    var aiList = $('#aiProviderList');
    if (aiList) {
      aiList.addEventListener('change', function (e) {
        var el = e.target;
        var card = el.closest ? el.closest('[data-pid]') : null;
        if (!card) return;
        var field = el.getAttribute('data-field');
        if (!field) return;
        onProviderField(card.getAttribute('data-pid'), field, el);
      });
    }

    // AI 供应商：当前使用切换
    var aiActive = $('#aiActive');
    if (aiActive) {
      aiActive.addEventListener('change', function (e) {
        var ai = aiState();
        if (findProvider(e.target.value)) {
          ai.activeId = e.target.value;
          scheduleSave();
        }
      });
    }

    // 复习卡片：点按显示答案 / 左右滑动评价
    var cardEl = $('#rvCard');
    var touch = null;
    var suppressTap = false;

    cardEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      if (suppressTap) { suppressTap = false; return; }
      if (review && !review.revealed) showAnswer();
    });

    cardEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      touch = { x: e.clientX, y: e.clientY, t: Date.now() };
    });

    cardEl.addEventListener('pointerup', function (e) {
      if (!touch) return;
      var dx = e.clientX - touch.x;
      var dy = e.clientY - touch.y;
      var dt = Date.now() - touch.t;
      touch = null;
      if (dt > 800) return;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (!review) return;
      if (!review.revealed) { showAnswer(); return; }
      suppressTap = true;
      var cls = dx > 0 ? 'swipe-right' : 'swipe-left';
      cardEl.classList.add(cls);
      setTimeout(function () {
        if (review) rate(dx > 0 ? 'ok' : 'bad');
      }, 140);
    });

    window.addEventListener('popstate', function () {
      if (viewStack > 0) {
        viewStack--;
        goHome();
      }
    });

    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushSave();
    });
  }

  /* ============================== 启动 ============================== */

  // 调试 / 自动化测试用的最小接口（不影响正常使用）
  window.MDReviewApp = {
    state: function () { return state; },
    importText: importText,
    importCardsJson: importCardsJson,
    startReview: startReview,
    showAnswer: showAnswer,
    rate: rate,
    renderHome: renderHome,
    openImportModal: openImportModal,
    addQueueFiles: addQueueFiles,
    importQueue: function () { return importQueue; },
    openQuick: openQuick,
    renderQuick: renderQuick,
    openManage: openManage,
    renderManage: renderManage,
    seedBundledDecks: seedBundledDecks,
    renderAiProviders: renderAiProviders,
    imgUrls: function () { return IMG_URLS; },
    rememberImage: rememberImage,
    resolveImgSrc: resolveImgSrc,
    version: APP_VERSION
  };

  function boot() {
    loadStoredImages();
    Store.load().then(function (raw) {
      var saved = null;
      if (raw) {
        try { saved = JSON.parse(raw); } catch (e) { saved = null; }
      }
      state = normalizeState(saved);
      pruneDaily();
      applyTheme();
      applyI18nStatic();
      var seeded = seedBundledDecks(false);
      bindEvents();
      renderHome();
      if (seeded) scheduleSave();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
