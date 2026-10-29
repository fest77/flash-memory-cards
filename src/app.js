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
  var APP_VERSION = '1.12.12';
  // 应用锁开关：手机系统普遍自带应用锁，默认隐藏该设置项（相关代码与原生桥全部保留）。
  // 需要恢复时把 false 改成 true（原生侧 APP_LOCK_ENABLED 同步改），选项即重新出现在「设置 → 存储」。
  var FEATURE_APP_LOCK = false;
  var LANGS = ['zh-Hans', 'zh-Hant', 'en'];
  var THEMES = ['dark', 'light'];

  /* ============================== 多语言 ============================== */

  var I18N = {
    'zh-Hans': {
      'app.title': 'MD 笔记闪卡 · 随机复习',
      'brand.name': 'MD闪记卡',
      'brand.tag': 'md → 知识点卡片 → 随机复习',
      'nav.manage': '笔记管理', 'nav.settings': '设置', 'nav.home': '主页', 'nav.stats': '统计', 'nav.bar': '主导航',
      'stats.title': '闪记日志', 'stats.heat': '热力图', 'stats.bars': '条形图', 'stats.note': '记录每天的复习次数 · 数据只保存在本机',
      'stats.today': '今日复习', 'stats.total': '累计复习', 'stats.streak': '连续天数',
      'stats.backToday': '回到今天', 'stats.tipCount': '复习 {n} 次', 'stats.tipNone': '无记录',
      'stats.year': '年', 'stats.month': '月', 'stats.day': '日',
      'stats.wds': '日,一,二,三,四,五,六',
      'stats.months': '1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月',
      'hero.title': '导入长篇笔记，拆成多张闪记卡', 'hero.sub': '随时复习，闪速记忆',
      'btn.import': '📥 导入 md / zip', 'btn.paste': '✍️ 粘贴 Markdown 文本', 'btn.demo': '看看示例（7 张卡）',
      'btn.importBatch': '📥 导入 md / zip（批量）', 'btn.pasteShort': '粘贴文本', 'btn.backup': '备份全部', 'btn.restoreBackup': '恢复备份',
      'set.importTitle': '导入与提问设置', 'set.aiTitle': 'AI 提炼设置（可选，需要你自己的 API）',
      'settings.storage': '存储', 'settings.ai': 'AI 供应商', 'ai.active': '当前使用', 'ai.addCustom': '＋ 自定义供应商（OpenAI 兼容）',
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
      'set.aiNote': '不经过任何服务器，请求从本机直接发到你在上面填的地址。浏览器直连多数厂商 API 可能被跨域拦截（CORS）：可以用本机 <b>Ollama</b>（启动前设 <code>OLLAMA_ORIGINS=*</code>），或改用电脑上的 <code>scripts/ai_cards.py</code> 生成卡片 JSON，再用「导入 AI 卡片」。',
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
      'about.checkUpdate': '检查更新',
      'update.checking': '检查中…', 'update.latest': '已经是最新版本',
      'update.newTitle': '发现新版本 v{v}', 'update.newBody': '当前版本 v{cur}，是否前往更新？',
      'update.yes': '是', 'update.no': '否', 'update.fail': '检查更新失败，请检查网络后重试',
      'home.allCards': '全部卡片 <b>{n}</b>', 'home.todoCards': '待复习 <b>{n}</b>', 'home.today': '今日已复习 <b>{n}</b>', 'home.due': '今日到期 <b>{n}</b>', 'home.resume': '继续上次复习：{name}（剩 {n} 张）', 'confirm.newSession': '有未完成的复习（剩 {n} 张），开始新复习会丢弃它，继续？', 'import.backupTitle': '导入备份', 'import.backupMeta': '笔记 {decks} 本 · 卡片 {cards} 张 · 图片 {images} 张', 'import.backupWhen': '导出于 {time} · 备份格式 v{v}', 'import.merge': '合并', 'import.overwrite': '覆盖', 'confirm.overwriteBackup': '覆盖将替换全部笔记与进度（本机当前数据会丢失），确定？',
      'deck.meta': '{n} 张卡片 · <span class="ok">已掌握 {k}</span> · <span class="todo">待复习 {t}</span>',
      'deck.review': '随机复习', 'deck.knownOf': '已掌握 {k}', 'deck.quick': '分类速记', 'deck.browse': '浏览/编辑',
      'deck.ai': 'AI 提炼', 'deck.export': '导出', 'deck.delete': '删除',
      'deck.reviewAll': '🎲 全部笔记混合随机复习',
      'toast.tooShort': '内容太短，没有导入', 'toast.noCards': '没有解析出卡片，试试换个「拆分方式」',
      'confirm.replaceDeck': '已存在同名笔记「{name}」，用新内容替换吗？（尽量保留已掌握进度）',
      'toast.cancelled': '已取消', 'toast.imported': '已导入「{name}」 {n} 张卡片',
      'import.title': '导入笔记', 'import.pick': '📄 选择文件（md 笔记 + 图片，可多选）', 'import.zip': '🗜️ 选择 .zip（多篇 md + 图片）', 'import.dir': '📁 导入整个文件夹（电脑端，含图片）',
      'import.note': '图片按<b>文件名</b>匹配 md 里的引用（如 ![](images/a.png) 取 a.png），同名会覆盖。图片只存本机，<b>「备份全部」不含图片</b>，换机后重新导入即可。zip 只在本地解压，不上传。',
      'import.empty': '还没有选择文件', 'import.doAll': '导入全部', 'import.doAllCount': '导入全部（{n}）',
      'toast.onlyMd': '未识别的文件（支持 md / txt / 图片）', 'toast.noFile': '没有选择文件',
      'toast.imgTaken': '已导入 {n} 张图片', 'toast.imgNoStore': '本机存储不可用，图片没有保存', 'toast.imgLost': '有 {n} 张图片保存失败（可能本机空间不足）', 'img.missing': '图片未导入', 'img.broken': '图片无法显示',
      'toast.saveFail': '保存失败：本机存储不可用，进度可能丢失', 'toast.backupMerged': '已合并 {n} 本笔记（本地进度保留）', 'import.suffix': '(导入)', 'toast.notZip': '请选择 .zip 文件', 'toast.unzipping': '正在解压…', 'toast.zipEmpty': 'zip 里没有找到 md / 图片文件',
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
      'ai.corsHelp': '跨域说明：浏览器直连多数厂商 API 会被 CORS 拦。可以改用支持跨域的中转/网关、本机 Ollama（启动时设 OLLAMA_ORIGINS=*），或者用电脑上的 scripts/ai_cards.py 生成卡片 JSON 再导入。',
      'ai.testNeedBase': '先填写 API 地址，例如 https://api.deepseek.com/v1', 'ai.testTitle': '测试 AI 连接',
      'ai.testing': '请求中…（最长等 {s} 秒）', 'ai.testOk': '连接成功', 'ai.testFail': '连接失败', 'ai.modelReply': '模型回复：',
      'ai.title': 'AI 提炼提问', 'ai.desc': '用大模型读懂每张卡的答案，把标题改写成更像面试题的问题（<b>只改题面，不动答案</b>）。请求从你的手机直接发出，不经过任何服务器。',
      'ai.notConfigured': '还没有配置 AI：到「设置 → AI 供应商」添加供应商并填 Key。',
      'ai.cardCount': '共 {n} 张卡', 'ai.ready': '已就绪', 'ai.notReady': '未配置', 'ai.canceled': '已停止提炼', 'img.cleanup': '清理未引用图片', 'img.repair': '修复图片索引', 'img.repairRunning': '正在检查图片…', 'img.repairOk': '图片索引正常（{n} 张）', 'img.repairDone': '已修复：补回 {added} 张、剔除 {dropped} 条失效记录（共 {total} 张）', 'img.repairRetyped': '，并纠正 {n} 张图片的格式信息', 'img.repairFail': '修复失败，请重试','search.ph': '搜索全部笔记…', 'search.empty': '没有匹配的卡片', 'search.more': '还有 {n} 条未显示', 'search.reviewFrom': '从这张开始复习', 'search.openDeck': '查看笔记', 'sort.recent': '最近导入', 'sort.name': '名称', 'sort.cards': '卡片数', 'sort.due': '待复习数','read.fs': '字号','pin.title': '应用锁（4 位密码）', 'pin.ph': '4 位数字密码', 'pin.set': '设置密码', 'pin.note': '仅本机存储（加盐哈希）；忘记密码只能清除全部数据。切后台 5 分钟后自动锁定。', 'pin.remove': '移除密码', 'pin.badFormat': '密码必须是 4 位数字', 'pin.setOk': '密码已设置', 'pin.removed': '密码已移除', 'pin.androidOnly': '应用锁仅安卓 App 可用', 'rem.title': '每日复习提醒', 'rem.set': '开启提醒', 'rem.cancel': '关闭提醒', 'rem.setOk': '提醒已开启（本地通知）', 'rem.cancelled': '提醒已关闭', 'rem.androidOnly': '系统提醒仅安卓 App 可用','card.editTitle': '编辑卡片', 'card.fTitle': '标题', 'card.fQuestion': '题面', 'card.fAnswer': '答案', 'card.editNote': '保存会尽量写回源 Markdown；无法定位时仅更新卡片并标记「已修改」。', 'card.editConfirm': '保存对这张卡片的修改？', 'card.answerRequired': '答案不能为空', 'card.savedRaw': '已保存（含源 Markdown）', 'card.savedLocal': '已保存（本地修改）', 'card.modified': '已修改', 'card.opEdit': '编辑', 'card.opSplit': '拆分', 'card.opMerge': '合并', 'card.opMove': '移动', 'card.opUndo': '撤销', 'card.splitTitle': '拆分为两张', 'card.splitNote': '光标位置即拆分点。', 'card.splitDo': '拆分', 'card.splitConfirm': '拆分这张卡片为两张？', 'card.splitFail': '拆分点两侧都需要内容', 'card.splitDone': '已拆分为两张', 'card.mergeConfirm': '把下一张卡片合并到这张？（下一张将被删除）', 'card.mergeFail': '没有下一张可合并', 'card.mergeDone': '已合并', 'card.moveTitle': '移动到其他笔记', 'card.moveDeck': '目标笔记', 'card.moveConfirm': '移动这张卡片？', 'card.moveDone': '已移动', 'card.noUndo': '没有可撤销的操作', 'card.undone': '已撤销上次操作', 'read.lh': '行距', 'read.cw': '卡片宽度', 'read.small': '小', 'read.medium': '中', 'read.large': '大', 'read.tight': '紧', 'read.loose': '松', 'read.narrow': '窄', 'read.wide': '宽', 'img.cleanupNone': '没有可清理的图片', 'img.cleanupConfirm': '发现 {n} 张未被任何卡片引用的图片（约 {kb} KB），删除？', 'img.cleanupDone': '已清理 {n} 张图片', 'backup.remind': '内容有改动且超过 7 天未备份，建议导出备份', 'backup.now': '立即备份', 'backup.nowBtn': '一键备份', 'backup.folderSet': '选择备份文件夹', 'backup.folderChange': '更换备份文件夹', 'backup.savedToFolder': '已写入备份文件夹：{name}', 'backup.fsaUnsupported': '当前浏览器不支持文件夹备份，已改为普通下载', 'ai.undo': '撤销本次提炼', 'ai.undone': '已恢复原题面', 'ai.undoFail': '无法撤销：笔记内容已变化', 'ai.start': '开始提炼',
      'ai.busy': '正在提炼，请稍等', 'ai.needConfig': '先配置 AI 地址和模型',
      'ai.progress': '提炼中… {done} / {total} 张（共 {batches} 批）',
      'ai.badFormat': '返回格式无法解析（需要 {"questions":[{"idx":..,"q":".."}]}）',
      'ai.done': '完成：改写 {n} 张卡', 'ai.doneFail': '完成：改写 {n} 张卡，{m} 批失败',
      'toast.badJson': '不是有效的 JSON 文件', 'toast.noDecks': '文件里没有 decks / cards',
      'card.untitled': '未命名', 'deck.aiDefault': 'AI 卡片', 'toast.nothingToImport': '没有可导入的卡片', 'toast.aiImported': '已导入 AI 卡片 {n} 张',
      'review.noTodo': '没有待复习的卡片（未掌握或已到期的）', 'review.noCards': '没有可复习的卡片',
      'review.allDecks': '全部笔记 · {n} 个文件', 'deck.defaultName': '笔记',
      'review.round2': '进入第 2 轮：再过一遍模糊/忘记的 {n} 张', 'review.setupTitle': '复习设置', 'review.count': '数量', 'review.limit20': '20 张', 'review.limit50': '50 张', 'review.limitAll': '全部', 'review.scope': '范围', 'review.scopeAll': '全部卡片', 'review.weak': '只看薄弱卡', 'review.chapters': '章节', 'review.chAll': '全部章节', 'review.start': '开始复习', 'review.undo': '撤销上一张', 'review.noUndo': '没有可撤销的评分', 'review.undone': '已恢复到评分前', 'review.noWeak': '没有薄弱卡，试试全部卡片', 'review.sessionGone': '上次会话已失效（有卡片被删除）', 'review.round2Label': '第 2 轮',
      'review.progress': '本轮 {rated} / {total} · 还剩 {left} 张',
      'review.done': '本轮完成', 'review.again': '🔁 再随机来一轮', 'review.againTodo': '只复习待复习的', 'review.backList': '返回列表', 'review.finished': '本轮结束',
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
      'brand.name': 'MD閃記卡',
      'brand.tag': 'md → 知識點卡片 → 隨機複習',
      'nav.manage': '筆記管理', 'nav.settings': '設定', 'nav.home': '主頁', 'nav.stats': '統計', 'nav.bar': '主導航',
      'stats.title': '閃記日誌', 'stats.heat': '熱力圖', 'stats.bars': '條形圖', 'stats.note': '記錄每天的複習次數 · 資料只保存在本機',
      'stats.today': '今日複習', 'stats.total': '累計複習', 'stats.streak': '連續天數',
      'stats.backToday': '回到今天', 'stats.tipCount': '複習 {n} 次', 'stats.tipNone': '無記錄',
      'stats.year': '年', 'stats.month': '月', 'stats.day': '日',
      'stats.wds': '日,一,二,三,四,五,六',
      'stats.months': '1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月',
      'hero.title': '匯入長篇筆記，拆成多張閃記卡', 'hero.sub': '隨時複習，閃速記憶',
      'btn.import': '📥 匯入 md / zip', 'btn.paste': '✍️ 貼上 Markdown 文字', 'btn.demo': '看看範例（7 張卡）',
      'btn.importBatch': '📥 匯入 md / zip（批次）', 'btn.pasteShort': '貼上文字', 'btn.backup': '備份全部', 'btn.restoreBackup': '還原備份',
      'set.importTitle': '匯入與提問設定', 'set.aiTitle': 'AI 提煉設定（可選，需要你自己的 API）',
      'settings.storage': '儲存', 'settings.ai': 'AI 供應商', 'ai.active': '當前使用', 'ai.addCustom': '＋ 自訂供應商（OpenAI 相容）',
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
      'set.aiNote': '不經過任何伺服器，請求從本機直接發到你在上面填的位址。瀏覽器直連多數廠商 API 可能被跨域攔截（CORS）：可以用本機 <b>Ollama</b>（啟動前設 <code>OLLAMA_ORIGINS=*</code>），或改用電腦上的 <code>scripts/ai_cards.py</code> 生成卡片 JSON，再用「匯入 AI 卡片」。',
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
      'about.checkUpdate': '檢查更新',
      'update.checking': '檢查中…', 'update.latest': '已經是最新版本',
      'update.newTitle': '發現新版本 v{v}', 'update.newBody': '當前版本 v{cur}，是否前往更新？',
      'update.yes': '是', 'update.no': '否', 'update.fail': '檢查更新失敗，請檢查網絡後重試',
      'home.allCards': '全部卡片 <b>{n}</b>', 'home.todoCards': '待複習 <b>{n}</b>', 'home.today': '今日已複習 <b>{n}</b>', 'home.due': '今日到期 <b>{n}</b>', 'home.resume': '繼續上次複習：{name}（剩 {n} 張）', 'confirm.newSession': '有未完成的複習（剩 {n} 張），開始新複習會丟棄它，繼續？', 'import.backupTitle': '匯入備份', 'import.backupMeta': '筆記 {decks} 本 · 卡片 {cards} 張 · 圖片 {images} 張', 'import.backupWhen': '匯出於 {time} · 備份格式 v{v}', 'import.merge': '合併', 'import.overwrite': '覆蓋', 'confirm.overwriteBackup': '覆蓋將替換全部筆記與進度（本機當前資料會丟失），確定？',
      'deck.meta': '{n} 張卡片 · <span class="ok">已掌握 {k}</span> · <span class="todo">待複習 {t}</span>',
      'deck.review': '隨機複習', 'deck.knownOf': '已掌握 {k}', 'deck.quick': '分類速記', 'deck.browse': '瀏覽/編輯',
      'deck.ai': 'AI 提煉', 'deck.export': '匯出', 'deck.delete': '刪除',
      'deck.reviewAll': '🎲 全部筆記混合隨機複習',
      'toast.tooShort': '內容太短，沒有匯入', 'toast.noCards': '沒有解析出卡片，試試換個「拆分方式」',
      'confirm.replaceDeck': '已存在同名筆記「{name}」，用新內容替換嗎？（盡量保留已掌握進度）',
      'toast.cancelled': '已取消', 'toast.imported': '已匯入「{name}」 {n} 張卡片',
      'import.title': '匯入筆記', 'import.pick': '📄 選擇檔案（md 筆記 + 圖片，可多選）', 'import.zip': '🗜️ 選擇 .zip（多篇 md + 圖片）', 'import.dir': '📁 匯入整個資料夾（電腦端，含圖片）',
      'import.note': '圖片按<b>檔名</b>匹配 md 裡的引用（如 ![](images/a.png) 取 a.png），同名會覆蓋。圖片只存本機，<b>「備份全部」不含圖片</b>，換機後重新匯入即可。zip 只在本機解壓，不上傳。',
      'import.empty': '還沒有選擇檔案', 'import.doAll': '匯入全部', 'import.doAllCount': '匯入全部（{n}）',
      'toast.onlyMd': '未識別的檔案（支援 md / txt / 圖片）', 'toast.noFile': '沒有選擇檔案',
      'toast.imgTaken': '已匯入 {n} 張圖片', 'toast.imgNoStore': '本機儲存不可用，圖片沒有保存', 'toast.imgLost': '有 {n} 張圖片保存失敗（可能本機空間不足）', 'img.missing': '圖片未匯入', 'img.broken': '圖片無法顯示',
      'toast.saveFail': '儲存失敗：本機儲存不可用，進度可能遺失', 'toast.backupMerged': '已合併 {n} 本筆記（本機進度保留）', 'import.suffix': '(匯入)', 'toast.notZip': '請選擇 .zip 檔案', 'toast.unzipping': '正在解壓…', 'toast.zipEmpty': 'zip 裡沒有找到 md / 圖片檔案',
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
      'ai.corsHelp': '跨域說明：瀏覽器直連多數廠商 API 會被 CORS 攔。可以改用支援跨域的中轉/閘道、本機 Ollama（啟動時設 OLLAMA_ORIGINS=*），或者用電腦上的 scripts/ai_cards.py 生成卡片 JSON 再匯入。',
      'ai.testNeedBase': '先填寫 API 位址，例如 https://api.deepseek.com/v1', 'ai.testTitle': '測試 AI 連線',
      'ai.testing': '請求中…（最長等 {s} 秒）', 'ai.testOk': '連線成功', 'ai.testFail': '連線失敗', 'ai.modelReply': '模型回覆：',
      'ai.title': 'AI 提煉提問', 'ai.desc': '用大模型讀懂每張卡的答案，把標題改寫成更像面試題的問題（<b>只改題面，不動答案</b>）。請求從你的手機直接發出，不經過任何伺服器。',
      'ai.notConfigured': '還沒有設定 AI：到「設定 → AI 供應商」新增供應商並填 Key。',
      'ai.cardCount': '共 {n} 張卡', 'ai.ready': '已就緒', 'ai.notReady': '未設定', 'ai.canceled': '已停止提煉', 'img.cleanup': '清理未引用圖片', 'img.repair': '修復圖片索引', 'img.repairRunning': '正在檢查圖片…', 'img.repairOk': '圖片索引正常（{n} 張）', 'img.repairDone': '已修復：補回 {added} 張、剔除 {dropped} 條失效記錄（共 {total} 張）', 'img.repairRetyped': '，並修正 {n} 張圖片的格式資訊', 'img.repairFail': '修復失敗，請重試','search.ph': '搜尋全部筆記…', 'search.empty': '沒有匹配的卡片', 'search.more': '還有 {n} 條未顯示', 'search.reviewFrom': '從這張開始複習', 'search.openDeck': '查看筆記', 'sort.recent': '最近匯入', 'sort.name': '名稱', 'sort.cards': '卡片數', 'sort.due': '待複習數','read.fs': '字號','pin.title': '應用鎖（4 位密碼）', 'pin.ph': '4 位數字密碼', 'pin.set': '設置密碼', 'pin.note': '僅本機存儲（加鹽哈希）；忘記密碼只能清除全部數據。切後台 5 分鐘後自動鎖定。', 'pin.remove': '移除密碼', 'pin.badFormat': '密碼必須是 4 位數字', 'pin.setOk': '密碼已設置', 'pin.removed': '密碼已移除', 'pin.androidOnly': '應用鎖僅安卓 App 可用', 'rem.title': '每日複習提醒', 'rem.set': '開啟提醒', 'rem.cancel': '關閉提醒', 'rem.setOk': '提醒已開啟（本機通知）', 'rem.cancelled': '提醒已關閉', 'rem.androidOnly': '系統提醒僅安卓 App 可用','card.editTitle': '編輯卡片', 'card.fTitle': '標題', 'card.fQuestion': '題面', 'card.fAnswer': '答案', 'card.editNote': '保存會盡量寫回源 Markdown；無法定位時僅更新卡片並標記「已修改」。', 'card.editConfirm': '保存對這張卡片的修改？', 'card.answerRequired': '答案不能為空', 'card.savedRaw': '已保存（含源 Markdown）', 'card.savedLocal': '已保存（本機修改）', 'card.modified': '已修改', 'card.opEdit': '編輯', 'card.opSplit': '拆分', 'card.opMerge': '合併', 'card.opMove': '移動', 'card.opUndo': '撤銷', 'card.splitTitle': '拆分為兩張', 'card.splitNote': '游標位置即拆分點。', 'card.splitDo': '拆分', 'card.splitConfirm': '拆分這張卡片為兩張？', 'card.splitFail': '拆分點兩側都需要內容', 'card.splitDone': '已拆分為兩張', 'card.mergeConfirm': '把下一張卡片合併到這張？（下一張將被刪除）', 'card.mergeFail': '沒有下一張可合併', 'card.mergeDone': '已合併', 'card.moveTitle': '移動到其他筆記', 'card.moveDeck': '目標筆記', 'card.moveConfirm': '移動這張卡片？', 'card.moveDone': '已移動', 'card.noUndo': '沒有可撤銷的操作', 'card.undone': '已撤銷上次操作', 'read.lh': '行距', 'read.cw': '卡片寬度', 'read.small': '小', 'read.medium': '中', 'read.large': '大', 'read.tight': '緊', 'read.loose': '鬆', 'read.narrow': '窄', 'read.wide': '寬', 'img.cleanupNone': '沒有可清理的圖片', 'img.cleanupConfirm': '發現 {n} 張未被任何卡片引用的圖片（約 {kb} KB），刪除？', 'img.cleanupDone': '已清理 {n} 張圖片', 'backup.remind': '內容有改動且超過 7 天未備份，建議匯出備份', 'backup.now': '立即備份', 'backup.nowBtn': '一鍵備份', 'backup.folderSet': '選擇備份資料夾', 'backup.folderChange': '更換備份資料夾', 'backup.savedToFolder': '已寫入備份資料夾：{name}', 'backup.fsaUnsupported': '當前瀏覽器不支持資料夾備份，已改為普通下載', 'ai.undo': '撤銷本次提煉', 'ai.undone': '已恢復原題面', 'ai.undoFail': '無法撤銷：筆記內容已變化', 'ai.start': '開始提煉',
      'ai.busy': '正在提煉，請稍等', 'ai.needConfig': '先設定 AI 位址和模型',
      'ai.progress': '提煉中… {done} / {total} 張（共 {batches} 批）',
      'ai.badFormat': '返回格式無法解析（需要 {"questions":[{"idx":..,"q":".."}]}）',
      'ai.done': '完成：改寫 {n} 張卡', 'ai.doneFail': '完成：改寫 {n} 張卡，{m} 批失敗',
      'toast.badJson': '不是有效的 JSON 檔案', 'toast.noDecks': '檔案裡沒有 decks / cards',
      'card.untitled': '未命名', 'deck.aiDefault': 'AI 卡片', 'toast.nothingToImport': '沒有可匯入的卡片', 'toast.aiImported': '已匯入 AI 卡片 {n} 張',
      'review.noTodo': '沒有待複習的卡片（未掌握或已到期的）', 'review.noCards': '沒有可複習的卡片',
      'review.allDecks': '全部筆記 · {n} 個檔案', 'deck.defaultName': '筆記',
      'review.round2': '進入第 2 輪：再過一遍模糊/忘記的 {n} 張', 'review.setupTitle': '複習設定', 'review.count': '數量', 'review.limit20': '20 張', 'review.limit50': '50 張', 'review.limitAll': '全部', 'review.scope': '範圍', 'review.scopeAll': '全部卡片', 'review.weak': '只看薄弱卡', 'review.chapters': '章節', 'review.chAll': '全部章節', 'review.start': '開始複習', 'review.undo': '撤銷上一張', 'review.noUndo': '沒有可撤銷的評分', 'review.undone': '已恢復到評分前', 'review.noWeak': '沒有薄弱卡，試試全部卡片', 'review.sessionGone': '上次會話已失效（有卡片被刪除）', 'review.round2Label': '第 2 輪',
      'review.progress': '本輪 {rated} / {total} · 還剩 {left} 張',
      'review.done': '本輪完成', 'review.again': '🔁 再隨機來一輪', 'review.againTodo': '只複習待複習的', 'review.backList': '返回列表', 'review.finished': '本輪結束',
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
      'brand.name': 'MD闪记卡',
      'brand.tag': 'md → cards → random review',
      'nav.manage': 'Notes', 'nav.settings': 'Settings', 'nav.home': 'Home', 'nav.stats': 'Stats', 'nav.bar': 'Main navigation',
      'stats.title': 'Review Log', 'stats.heat': 'Heatmap', 'stats.bars': 'Bars', 'stats.note': 'Daily review counts · stored on this device only',
      'stats.today': 'today', 'stats.total': 'total', 'stats.streak': 'day streak',
      'stats.backToday': 'Back to today', 'stats.tipCount': '{n} reviews', 'stats.tipNone': 'no reviews',
      'stats.year': 'Year', 'stats.month': 'Month', 'stats.day': 'Day',
      'stats.wds': 'Su,Mo,Tu,We,Th,Fr,Sa',
      'stats.months': 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec',
      'hero.title': 'Import long notes, split into flashcards', 'hero.sub': 'Review anytime, remember fast',
      'btn.import': '📥 Import md / zip', 'btn.paste': '✍️ Paste Markdown text', 'btn.demo': 'Try the sample (7 cards)',
      'btn.importBatch': '📥 Import md / zip (batch)', 'btn.pasteShort': 'Paste text', 'btn.backup': 'Backup all', 'btn.restoreBackup': 'Restore backup',
      'set.importTitle': 'Import & question settings', 'set.aiTitle': 'AI refine settings (optional, your own API)',
      'settings.storage': 'Storage', 'settings.ai': 'AI providers', 'ai.active': 'Active provider', 'ai.addCustom': '＋ Custom provider (OpenAI-compatible)',
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
      'set.aiNote': 'No server involved: requests go straight from this device to the API you enter. Most LLM APIs block browser calls via CORS — use local <b>Ollama</b> (set <code>OLLAMA_ORIGINS=*</code> before starting), or run <code>scripts/ai_cards.py</code> on a PC to generate card JSON, then use "Import AI cards".',
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
      'about.checkUpdate': 'Check for updates',
      'update.checking': 'Checking…', 'update.latest': 'You are up to date',
      'update.newTitle': 'New version v{v} available', 'update.newBody': 'Current version is v{cur}. Update now?',
      'update.yes': 'Yes', 'update.no': 'No', 'update.fail': 'Update check failed, please try again later',
      'home.allCards': 'All cards <b>{n}</b>', 'home.todoCards': 'To review <b>{n}</b>', 'home.today': 'Reviewed today <b>{n}</b>', 'home.due': 'Due today <b>{n}</b>', 'home.resume': 'Resume last session: {name} ({n} left)', 'confirm.newSession': 'An unfinished review ({n} cards) will be discarded. Start a new one anyway?', 'import.backupTitle': 'Import backup', 'import.backupMeta': '{decks} notes · {cards} cards · {images} images', 'import.backupWhen': 'Exported {time} · format v{v}', 'import.merge': 'Merge', 'import.overwrite': 'Overwrite', 'confirm.overwriteBackup': 'Overwrite replaces all notes and progress (current data will be lost). Continue?',
      'deck.meta': '{n} cards · <span class="ok">{k} known</span> · <span class="todo">{t} to go</span>',
      'deck.review': 'Review', 'deck.knownOf': '{k} known', 'deck.quick': 'Quick read', 'deck.browse': 'Browse/Edit',
      'deck.ai': 'AI refine', 'deck.export': 'Export', 'deck.delete': 'Delete',
      'deck.reviewAll': '🎲 Mixed review of all notes',
      'toast.tooShort': 'Content too short — not imported', 'toast.noCards': 'No cards parsed; try another split mode',
      'confirm.replaceDeck': 'A note named "{name}" already exists. Replace it with the new content? (mastered progress is kept where possible)',
      'toast.cancelled': 'Cancelled', 'toast.imported': 'Imported "{name}" — {n} cards',
      'import.title': 'Import notes', 'import.pick': '📄 Pick files (md notes + images, multi-select)', 'import.zip': '🗜️ Pick a .zip (md files + images)', 'import.dir': '📁 Import a whole folder (desktop, images included)',
      'import.note': 'Images are matched by <b>filename</b> against references in the md (e.g. ![](images/a.png) uses a.png); same-name images overwrite. Images stay on this device and are <b>not included in backups</b> — re-import after switching devices. Zip files are unpacked locally, nothing is uploaded.',
      'import.empty': 'No files selected yet', 'import.doAll': 'Import all', 'import.doAllCount': 'Import all ({n})',
      'toast.onlyMd': 'Unrecognized files (md / txt / images only)', 'toast.noFile': 'No file selected',
      'toast.imgTaken': 'Imported {n} images', 'toast.imgNoStore': 'Local storage unavailable, images not saved', 'toast.imgLost': '{n} images could not be saved (storage may be full)', 'img.missing': 'Image not imported', 'img.broken': 'Image cannot be shown',
      'toast.saveFail': 'Save failed: local storage unavailable, progress may be lost', 'toast.backupMerged': 'Merged {n} notes (local progress kept)', 'import.suffix': ' (imported)', 'toast.notZip': 'Please choose a .zip file', 'toast.unzipping': 'Unpacking…', 'toast.zipEmpty': 'No .md / .txt files found in the zip',
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
      'ai.corsHelp': 'About CORS: most LLM APIs block direct browser calls. Use a CORS-enabled proxy, local Ollama (set OLLAMA_ORIGINS=* when starting), or run scripts/ai_cards.py on a PC to build card JSON and import it.',
      'ai.testNeedBase': 'Enter the API URL first, e.g. https://api.deepseek.com/v1', 'ai.testTitle': 'Test AI connection',
      'ai.testing': 'Requesting… (up to {s} s)', 'ai.testOk': 'Connected', 'ai.testFail': 'Connection failed', 'ai.modelReply': 'Model reply: ',
      'ai.title': 'AI question refine', 'ai.desc': 'Have an LLM rewrite each card\'s title into an interview-style question (<b>questions only, answers untouched</b>). Requests go straight from your phone to the API; no server in between.',
      'ai.notConfigured': 'AI is not configured: add a provider and fill in the key under Settings → AI providers.',
      'ai.cardCount': '{n} cards', 'ai.ready': 'Ready', 'ai.notReady': 'Not configured', 'ai.canceled': 'Refining stopped', 'img.cleanup': 'Clean unused images', 'img.repair': 'Repair image index', 'img.repairRunning': 'Checking images…', 'img.repairOk': 'Image index is healthy ({n} images)', 'img.repairDone': 'Repaired: {added} restored, {dropped} stale entries dropped ({total} images)', 'img.repairRetyped': ', {n} image type(s) corrected', 'img.repairFail': 'Repair failed, please retry','search.ph': 'Search all notes…', 'search.empty': 'No matching cards', 'search.more': '{n} more not shown', 'search.reviewFrom': 'Review from this card', 'search.openDeck': 'Open note', 'sort.recent': 'Recent', 'sort.name': 'Name', 'sort.cards': 'Cards', 'sort.due': 'Due','read.fs': 'Font size','pin.title': 'App lock (4-digit password)', 'pin.ph': '4-digit password', 'pin.set': 'Set password', 'pin.note': 'Stored locally (salted hash); forgetting the password requires clearing all data. Auto-locks 5 minutes after backgrounding.', 'pin.remove': 'Remove password', 'pin.badFormat': 'Password must be 4 digits', 'pin.setOk': 'Password set', 'pin.removed': 'Password removed', 'pin.androidOnly': 'App lock is Android-only', 'rem.title': 'Daily review reminder', 'rem.set': 'Enable', 'rem.cancel': 'Disable', 'rem.setOk': 'Reminder enabled (local notification)', 'rem.cancelled': 'Reminder disabled', 'rem.androidOnly': 'System reminders are Android-only','card.editTitle': 'Edit card', 'card.fTitle': 'Title', 'card.fQuestion': 'Question', 'card.fAnswer': 'Answer', 'card.editNote': 'Saving writes back to the source Markdown when possible; otherwise the card is updated locally and marked modified.', 'card.editConfirm': 'Save changes to this card?', 'card.answerRequired': 'Answer cannot be empty', 'card.savedRaw': 'Saved (source Markdown updated)', 'card.savedLocal': 'Saved (local edit)', 'card.modified': 'modified', 'card.opEdit': 'Edit', 'card.opSplit': 'Split', 'card.opMerge': 'Merge', 'card.opMove': 'Move', 'card.opUndo': 'Undo', 'card.splitTitle': 'Split into two', 'card.splitNote': 'The cursor position is the split point.', 'card.splitDo': 'Split', 'card.splitConfirm': 'Split this card into two?', 'card.splitFail': 'Both sides need content', 'card.splitDone': 'Split into two', 'card.mergeConfirm': 'Merge the next card into this one? (the next card will be removed)', 'card.mergeFail': 'No next card to merge', 'card.mergeDone': 'Merged', 'card.moveTitle': 'Move to another note', 'card.moveDeck': 'Target note', 'card.moveConfirm': 'Move this card?', 'card.moveDone': 'Moved', 'card.noUndo': 'Nothing to undo', 'card.undone': 'Last operation undone', 'read.lh': 'Line height', 'read.cw': 'Card width', 'read.small': 'Small', 'read.medium': 'Medium', 'read.large': 'Large', 'read.tight': 'Tight', 'read.loose': 'Loose', 'read.narrow': 'Narrow', 'read.wide': 'Wide', 'img.cleanupNone': 'No unused images', 'img.cleanupConfirm': '{n} images are not referenced by any card (~{kb} KB). Delete?', 'img.cleanupDone': 'Cleaned {n} images', 'backup.remind': 'Changes not backed up for 7+ days — export a backup', 'backup.now': 'Back up', 'backup.nowBtn': 'Back up now', 'backup.folderSet': 'Choose backup folder', 'backup.folderChange': 'Change backup folder', 'backup.savedToFolder': 'Saved to backup folder: {name}', 'backup.fsaUnsupported': 'Folder backup not supported here — using normal download', 'ai.undo': 'Undo this refine', 'ai.undone': 'Original questions restored', 'ai.undoFail': 'Cannot undo: the deck has changed', 'ai.start': 'Start refine',
      'ai.busy': 'Refine in progress, please wait', 'ai.needConfig': 'Configure the API URL and model first',
      'ai.progress': 'Refining… {done} / {total} cards ({batches} batches)',
      'ai.badFormat': 'Unparseable response (expected {"questions":[{"idx":..,"q":".."}]})',
      'ai.done': 'Done: {n} cards rewritten', 'ai.doneFail': 'Done: {n} cards rewritten, {m} batches failed',
      'toast.badJson': 'Not a valid JSON file', 'toast.noDecks': 'No decks / cards in the file',
      'card.untitled': 'Untitled', 'deck.aiDefault': 'AI cards', 'toast.nothingToImport': 'No importable cards', 'toast.aiImported': 'Imported {n} AI cards',
      'review.noTodo': 'No cards to review (unmastered or due)', 'review.noCards': 'No cards to review',
      'review.allDecks': 'All notes · {n} files', 'deck.defaultName': 'Note',
      'review.round2': 'Round 2: replaying the {n} fuzzy/forgotten cards', 'review.setupTitle': 'Review options', 'review.count': 'Cards', 'review.limit20': '20', 'review.limit50': '50', 'review.limitAll': 'All', 'review.scope': 'Scope', 'review.scopeAll': 'All cards', 'review.weak': 'Weak cards only', 'review.chapters': 'Sections', 'review.chAll': 'All sections', 'review.start': 'Start', 'review.undo': 'Undo last rating', 'review.noUndo': 'Nothing to undo', 'review.undone': 'Rating undone', 'review.noWeak': 'No weak cards — try all cards', 'review.sessionGone': 'Last session is no longer valid (cards were deleted)', 'review.round2Label': 'Round 2',
      'review.progress': 'This round {rated} / {total} · {left} left',
      'review.done': 'Round complete', 'review.again': '🔁 Another random round', 'review.againTodo': 'Review due & unmastered', 'review.backList': 'Back to list', 'review.finished': 'Round finished',
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

  function applyReading() {
    var r = (state && state.settings && state.settings.reading) || {};
    var fs = { s: '0.92', m: '1', l: '1.14' }[r.fs] || '1';
    var lh = { 1: '1.5', 2: '1.7', 3: '1.95' }[r.lh] || '1.7';
    var cw = { 1: '520px', 2: '640px', 3: '100%' }[r.cw] || '640px';
    var root = document.documentElement;
    root.style.setProperty('--rv-scale', fs);
    root.style.setProperty('--rv-lh', lh);
    root.style.setProperty('--rv-cw', cw);
  }

  function onReadingChange(key, val) {
    if (!state.settings.reading) state.settings.reading = { fs: 'm', lh: 2, cw: 2 };
    state.settings.reading[key] = val;
    applyReading();
    flushSave();
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
    var wiping = false; // 清库期间禁止重新打开连接（异步保存会把 deleteDatabase 重新 blocked）
    var wipeLocked = false; // 清库已开始：所有写入（IDB 与 localStorage）一律丢弃

    function openDB() {
      if (wiping) return Promise.resolve(null); // 清库中：读写直接失败，不再新建连接
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

    /* 列出 kv 里的所有键：图片索引丢失时，用它从真实存储重建（唯一可靠的真相来源）。
       注意：拿不到连接/读失败时返回 null（不是空数组）——重建索引必须能区分「真的没有图」和「读不到」，
       否则一次瞬时打开失败就会把好索引清空 */
    function idbKeys() {
      return new Promise(function (resolve) {
        if (!db) return resolve(null);
        try {
          var tx = db.transaction('kv', 'readonly');
          var r = tx.objectStore('kv').getAllKeys();
          r.onsuccess = function () { resolve(r.result || []); };
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
        if (wipeLocked || wiping) return Promise.resolve(false); // 清库中/已清库：不再写入任何存储
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
      /** 关闭连接并清空缓存：deleteDatabase 前必须调用，否则永远 blocked */
      close: function () {
        wiping = true;
        var closing = db;
        db = null;
        dbPromise = null;
        if (closing) { try { closing.close(); } catch (e) { /* ignore */ } }
        return true;
      },
      /** 清库失败/取消后恢复可用（允许重新打开连接） */
      reopen: function () { wiping = false; wipeLocked = false; db = null; dbPromise = null; },
      isWiping: function () { return wiping; },
      lockWrites: function () { wipeLocked = true; },
      isLocked: function () { return wipeLocked; },
      rawPut: function (key, val) { return openDB().then(function () { return idbPut(key, val); }); },
      rawKeys: function () { return openDB().then(function () { return idbKeys(); }); },
      rawDelete: function (key) {
        return openDB().then(function () {
          return new Promise(function (resolve) {
            if (!db) return resolve(false);
            try {
              var tx = db.transaction('kv', 'readwrite');
              tx.objectStore('kv').delete(key);
              tx.oncomplete = function () { resolve(true); };
              tx.onerror = function () { resolve(false); };
            } catch (e) { resolve(false); }
          });
        });
      }
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
      lastBackupAt: 0,
      lastChangeAt: 0,
      backupRemindDismissedAt: 0,
      settings: {
        mode: 'auto',
        gran: 'mid',
        qstyle: 'prompt',
        filter: 'all',
        theme: 'dark',
        lang: 'zh-Hans',
        statsView: 'heat',
        bundledVersion: '',
        reading: { fs: 'm', lh: 2, cw: 2 },
        tagFilter: '',
        deckSort: 'recent',
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
            path: Array.isArray(c.path) ? c.path : [],
            chapter: typeof c.chapter === 'string' ? c.chapter : '',
            tags: Array.isArray(c.tags) ? c.tags.map(function (x) { return String(x); }).filter(Boolean) : [],
            modified: !!c.modified
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
          tags: Array.isArray(d.tags) ? d.tags.map(function (x) { return String(x); }).filter(Boolean) : [],
          source: typeof d.source === 'string' ? d.source : '',
          bundled: !!d.bundled,
          cards: cards
        });
      });
    }
    if (raw.stats && typeof raw.stats === 'object') s.stats = raw.stats;
    if (raw.daily && typeof raw.daily === 'object') s.daily = raw.daily;
    if (raw.reviewSession && typeof raw.reviewSession === 'object' && Array.isArray(raw.reviewSession.queueIds)) {
      s.reviewSession = raw.reviewSession; // 复习会话（继续上次）
    }
    ['lastBackupAt', 'lastChangeAt', 'backupRemindDismissedAt'].forEach(function (k) {
      if (typeof raw[k] === 'number') s[k] = raw[k];
    });
    if (raw.settings && typeof raw.settings === 'object') {
      Object.keys(s.settings).forEach(function (k) {
        if (raw.settings[k] != null) s.settings[k] = raw.settings[k];
      });
    }
    if (!s.settings.reading || typeof s.settings.reading !== 'object') s.settings.reading = { fs: 'm', lh: 2, cw: 2 };
    if (!GRAN[s.settings.gran]) s.settings.gran = 'mid';
    if (!MODE_LABELS[s.settings.mode]) s.settings.mode = 'auto';
    if (!QSTYLE_LABELS[s.settings.qstyle]) s.settings.qstyle = 'prompt';
    if (s.settings.filter !== 'todo') s.settings.filter = 'all';
    if (THEMES.indexOf(s.settings.theme) < 0) s.settings.theme = 'dark';
    if (s.settings.statsView !== 'bars') s.settings.statsView = 'heat';
    if (typeof s.settings.tagFilter !== 'string') s.settings.tagFilter = '';
    if (['recent', 'name', 'cards', 'due'].indexOf(s.settings.deckSort) < 0) s.settings.deckSort = 'recent';
    if (LANGS.indexOf(s.settings.lang) < 0) s.settings.lang = 'zh-Hans';
    s.settings.ai = normalizeAi(raw.settings && raw.settings.ai);
    return s;
  }

  function pruneDaily() {
    var keys = Object.keys(state.daily);
    if (keys.length < 400) return;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 370);
    var min = cutoff.getFullYear() + '-' + pad2(cutoff.getMonth() + 1) + '-' + pad2(cutoff.getDate());
    keys.forEach(function (k) {
      if (k < min) delete state.daily[k];
    });
  }

  var saveFailShown = 0;
  function notifySaveFail() {
    // 存储失败不能静默：节流到每 60 秒最多提示一次，避免刷屏
    var now = Date.now();
    if (now - saveFailShown < 60000) return;
    saveFailShown = now;
    toast(t('toast.saveFail'), 5000);
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      state.lastChangeAt = Date.now(); // 有改动才保存：保存即视为一次变更
      var json = JSON.stringify(state);
      Store.save(json).then(function (ok) {
        if (ok === false) notifySaveFail();
      }).catch(notifySaveFail);
    }, 250);
  }

  var flushCount = 0;
  /** 立即落盘，返回 Promise<boolean>（测试需要确定性；现有调用方忽略返回值） */
  function flushSave() {
    flushCount++;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (Store.isLocked && Store.isLocked()) return Promise.resolve(false); // 清库后不再写
    try {
      var json = JSON.stringify(state);
      // 测试用落盘日志（未设置 window.__mdfcSaveLog 时零开销）：记录每次落盘的 currentId
      if (window.__mdfcSaveLog) {
        try { window.__mdfcSaveLog.push(state.reviewSession ? state.reviewSession.currentId : null); } catch (e) { /* ignore */ }
      }
      var pr = Store.save(json);
      if (pr && typeof pr.then === 'function') {
        return pr.then(function (ok) {
          if (ok === false) notifySaveFail();
          return ok;
        }, function () { notifySaveFail(); return false; });
      }
      return Promise.resolve(true);
    } catch (e) {
      notifySaveFail();
      return Promise.resolve(false);
    }
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

  function endOfTodayMs() {
    var d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  /** 是否到期：无 box（旧卡/新卡）视为今日到期；有 box 看 dueAt 是否不晚于今天结束 */
  function isDueStat(st) {
    return Core.isDue(st, endOfTodayMs());
  }

  /** 薄弱卡（严格过滤）：有过错误，或已复习过（有 n）且仍在盒 1；没学过的新卡不算 */
  function statusOfStat(st) {
    return st && st.s === 'known' ? 'known' : 'learning';
  }

  function isWeakStat(st) {
    if (!st || !(st.n > 0)) return false;
    if ((st.bad || 0) > 0) return true;
    if (st.box === 1) return true;
    return false;
  }

  /** 待复习（todo 口径）：未掌握，或已掌握但今日到期——known 且未到期才排除 */
  function isTodoStat(st) {
    if (statusOfStat(st) !== 'known') return true;
    return isDueStat(st);
  }

  function todoCountAll() {
    var n = 0;
    state.decks.forEach(function (d) {
      d.cards.forEach(function (c) { if (isTodoStat(state.stats[c.id])) n++; });
    });
    return n;
  }

  function dueCountAll() {
    var n = 0;
    state.decks.forEach(function (d) {
      d.cards.forEach(function (c) { if (isDueStat(state.stats[c.id])) n++; });
    });
    return n;
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
    if (typeof aiRun !== 'undefined' && aiRun.active) aiRun.cancel = true; // 关掉进度弹窗 = 停止后续批次
  }

  function showView(name, noPush) {
    $$('.view').forEach(function (v) { v.classList.remove('active'); });
    var v = $('#view-' + name);
    if (v) v.classList.add('active');
    var tabName = (name === 'review' || name === 'quick' || name === 'browse') ? 'home' : name;
    $$('#tabbar .tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === tabName);
    });
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

  function decodeTextBytes(buf) {
    var b = new Uint8Array(buf);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
    catch (e) { /* 不是合法 UTF-8：多半是 Windows GBK 中文笔记 */ }
    try { return new TextDecoder('gbk').decode(b); } catch (e2) { /* 引擎不支持 gbk */ }
    return new TextDecoder('utf-8').decode(b);
  }

  function readFileText(file) {
    if (file && typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer().then(decodeTextBytes);
    }
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

  /**
   * 按扩展名纠正 Blob 的 MIME 类型再交给浏览器解码。
   * Android 文件选择器 / 网盘 / 微信目录常把 svg 之类的文件报成 application/octet-stream
   * 或空类型；Chromium 对 PNG/JPEG 会嗅探文件头照常渲染，但 SVG 只认 image/svg+xml，
   * 类型不对就整张图解码失败（只显示 alt 文字）。所以这类图必须按名字重新包一层。
   */
  function normalizeImageBlob(blob, name) {
    if (!blob) return blob;
    var want = imgMime(name);
    if (want === 'application/octet-stream') return blob;
    var have = String(blob.type || '').split(';')[0].trim().toLowerCase();
    if (have === want) return blob;
    try { return new Blob([blob], { type: want }); } catch (e) { return blob; }
  }

  function loadStoredImages() {
    // 先按真实存储重建索引，再从索引建 URL：索引曾经丢条目 → 图片全部显示「未导入」
    return repairImageIndex().then(function (rep) {
      return Store.rawGet('imgIndex').then(function (list) {
        var retyped = 0;
        // 必须等 URL 全部就绪才返回：否则修复后立刻重绘仍是「未导入」占位
        return Promise.all((list || []).map(function (n) {
          if (IMG_URLS[n]) return null;
          return Store.rawGet('img/' + n).then(function (rec) {
            if (rec && rec.blob) {
              var b = normalizeImageBlob(rec.blob, n);
              if (b !== rec.blob) retyped++;
              try { IMG_URLS[n] = URL.createObjectURL(b); } catch (e) { /* ignore */ }
            }
            return null;
          });
        })).then(function () {
          if (rep) rep.retyped = retyped;
          return rep;
        });
      });
    }).catch(function () { return null; });
  }

  function rememberImage(base, blob) {
    if (IMG_URLS[base]) { try { URL.revokeObjectURL(IMG_URLS[base]); } catch (e) { /* ignore */ } }
    try { IMG_URLS[base] = URL.createObjectURL(blob); return true; } catch (e) { return false; }
  }

  function blobDigest(blob) {
    // 内容指纹：优先 sha1（crypto.subtle），不可用时退化为 size+首尾字节
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return blob.arrayBuffer().then(function (ab) {
        return crypto.subtle.digest('SHA-1', ab).then(function (h) {
          var u = new Uint8Array(h);
          var s = '';
          for (var i = 0; i < u.length; i++) s += (u[i] + 0x100).toString(16).slice(1);
          return 'sha1:' + s;
        });
      });
    }
    return blob.arrayBuffer().then(function (ab) {
      var u = new Uint8Array(ab);
      var head = u.length ? u[0] + ',' + u[u.length - 1] : '0';
      return 'weak:' + ab.byteLength + ':' + head;
    });
  }

  /* 批次导入期间 图片原名 → 实际存储名 的映射（导入 md 时重写引用） */
  var IMG_RENAMES = {};

  /* imgIndex 的所有读-改-写必须串行：并行导入 40 张图时，并发更新曾丢掉 39 条索引
     → 重启后这些图全部显示「图片未导入」，且重导同样的 zip 也修不回来 */
  var imgIndexChain = Promise.resolve();
  function withImgIndex(fn) {
    var run = imgIndexChain.then(fn, fn); // 前一个失败也继续
    imgIndexChain = run.then(function () {}, function () {});
    return run;
  }

  function addToImgIndex(nm) {
    return withImgIndex(function () {
      return Store.rawGet('imgIndex').then(function (list) {
        list = list || [];
        if (list.indexOf(nm) >= 0) return nm;
        list.push(nm);
        return Store.rawPut('imgIndex', list).then(function () { return nm; });
      });
    });
  }

  /** 以真实存储键为准重建 imgIndex（丢条目补回、幽灵条目剔除），返回 {added, dropped, total} */
  function repairImageIndex() {
    return withImgIndex(function () {
      return Store.rawKeys().then(function (keys) {
        if (!keys) return { added: 0, dropped: 0, total: -1, unavailable: true }; // 读不到就不动索引
        var present = (keys || []).map(String).filter(function (k) {
          return k.indexOf('img/') === 0;
        }).map(function (k) { return k.slice(4); });
        return Store.rawGet('imgIndex').then(function (cur) {
          var old = cur || [];
          var kept = old.filter(function (n) { return present.indexOf(n) >= 0; });
          var fresh = present.filter(function (n) { return old.indexOf(n) < 0; });
          return Store.rawPut('imgIndex', kept.concat(fresh)).then(function () {
            return { added: fresh.length, dropped: old.length - kept.length, total: kept.length + fresh.length };
          });
        });
      });
    });
  }

  function storeImage(name, blob, renameMap, outMap) {
    var base = imgBase(name);
    blob = normalizeImageBlob(blob, base); // 存进来就纠正类型：否则 SVG 永远解不出来
    var commit = function (nm) {
      return Store.rawPut('img/' + nm, { blob: blob, name: nm, added: Date.now() }).then(function (ok) {
        if (!ok) return null;
        rememberImage(nm, blob);
        return addToImgIndex(nm);
      });
    };
    var bumpName = function (nm) {
      var m = /^(.*?)(-\d+)?(\.[^.]+)$/.exec(nm);
      if (!m) return nm + '-2';
      return m[1] + '-' + (parseInt((m[2] || '-1').slice(1), 10) + 1) + m[3];
    };
    // 返回：最终存储名（可能是 -2/-3 改名）；null = 失败
    var tryName = function (nm) {
      return Store.rawGet('img/' + nm).then(function (ex) {
        if (!ex) return commit(nm);
        return Promise.all([blobDigest(blob), blobDigest(ex.blob)]).then(function (d) {
          if (d[0] === d[1]) {
            // 内容已存在（去重）：顺手把索引和内存 URL 补上——
            // 否则索引丢过条目时，重导同样的 zip 只是「静默命中」，页面依旧显示未导入。
            // 已有 URL 时不重建：重建会 revoke 旧 URL，正在滚动加载的 <img> 会瞬间变破图；
            // 新 URL 用纠正过类型的 Blob：库里可能是旧版本留下的坏类型记录
            if (!IMG_URLS[nm]) rememberImage(nm, normalizeImageBlob(ex.blob, nm));
            return addToImgIndex(nm).then(function () { return nm; });
          }
          return tryName(bumpName(nm));
        });
      });
    };
    return tryName(base).then(function (nm) {
      if (!nm) return null;
      // 路径映射要拿到每张图的最终名字（zip 里不同子目录可以有同名文件）
      if (outMap) outMap[name] = nm;
      if (nm !== base && renameMap) renameMap[base] = nm; // 改名了：记录映射供重写引用
      return nm;
    });
  }

  /**
   * 串行存图（不要 Promise.all）：不同子目录的同名图片并行进来时，多个 tryName 会同时看到
   * 「这个名字还不存在」，于是各自 commit 同一个键，后写的覆盖先写的——实测 251 张图里
   * 53 张被覆盖丢失（只剩 198 个名字）。串行后每张图都能拿到独立名字（img001.png / -2 / -3）。
   */
  function importImageEntries(entries, outMap) { // [{name, bytes}]（zip 内）→ Promise(成功数)
    var n = 0;
    return entries.reduce(function (p, en) {
      return p.then(function () {
        if (!en || !en.bytes) return null;
        return storeImage(en.name, new Blob([en.bytes], { type: imgMime(en.name) }), null, outMap).then(function (nm) {
          if (nm) n++;
        });
      });
    }, Promise.resolve()).then(function () { return n; });
  }

  function importImageFiles(files) { // File[] → Promise(成功数)；改名记入全局映射供本批 md 重写
    var n = 0;
    return files.reduce(function (p, f) {
      return p.then(function () {
        return storeImage(f.name, f, IMG_RENAMES).then(function (nm) { if (nm) n++; });
      });
    }, Promise.resolve()).then(function () { return n; });
  }

  /* zip 内相对路径归一：md 所在目录 + 引用路径 → zip 里的完整路径 */
  function zipJoin(dir, ref) {
    var q = String(ref || '').replace(/\\/g, '/');
    if (q.indexOf('?') >= 0) q = q.slice(0, q.indexOf('?'));
    if (q.charAt(0) === '/') dir = '';
    var parts = String((dir || '') + q.replace(/^\.?\//, '')).split('/');
    var out = [];
    parts.forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') { out.pop(); return; }
      out.push(seg);
    });
    return out.join('/');
  }

  /**
   * 按「zip 内完整路径」重写一份 md 的图片引用。
   * 只按文件名重写会把别的子目录的同名图套到这篇笔记上（实测 251 张图里 50 处引用拿到了错图），
   * 所以先按路径精确匹配；路径没命中时才退回「文件名唯一」的匹配。
   */
  function rewriteZipImageRefs(text, dir, pathMap) {
    if (!text || !pathMap) return text;
    var baseMap = Object.create(null);
    Object.keys(pathMap).forEach(function (p) {
      var b = p.split('/').pop();
      var nm = pathMap[p];
      if (!(b in baseMap)) baseMap[b] = nm;
      else if (baseMap[b] !== nm) baseMap[b] = null; // 同名不同图：只能按路径认
    });
    var fix = function (ref) {
      // 先按 md 所在目录拼；再试「相对 zip 根」的写法（很多导出工具写的是根相对路径）
      var hit = pathMap[zipJoin(dir, ref)] || pathMap[zipJoin('', ref)];
      if (hit) return hit;
      var b = String(ref).split('/').pop();
      return baseMap[b] || ref;
    };
    text = text.replace(/(!\[[^\]]*\]\()([^)\s]+)/g, function (m, pre, p) { return pre + fix(p); });
    text = text.replace(/(!\[\[)([^\]|\r\n]+)/g, function (m, pre, p) { return pre + fix(p); });
    return text;
  }

  /** 所有卡片引用的图片名集合（![]() / ![[..]] / （配图 x）） */
  function referencedImageNames() {
    var set = Object.create(null);
    state.decks.forEach(function (d) {
      d.cards.forEach(function (c) {
        [c.title, c.question, c.answer].forEach(function (txt) {
          String(txt || '').replace(/!\[\[([^\]\n|]+)(?:\|[^\]\n]*)?\]\]/g, function (m, p) {
            set[imgBase(p)] = 1; return m;
          }).replace(/!\[[^\]]*\]\(([^)\s]+)/g, function (m, p) {
            if (!/^(?:https?:|blob:|data:)/i.test(p)) set[imgBase(p)] = 1;
            return m;
          }).replace(/（配图\s*([^）]+?)）/g, function (m, p) {
            set[imgBase(p)] = 1; return m;
          });
        });
      });
    });
    return set;
  }

  /** 无引用图片：[{name, size}]（读记录算大小） */
  function unreferencedImages() {
    var ref = referencedImageNames();
    return Store.rawGet('imgIndex').then(function (list) {
      list = list || [];
      return Promise.all(list.map(function (nm) {
        return Store.rawGet('img/' + nm).then(function (rec) {
          if (ref[nm]) return null;
          return { name: nm, size: rec && rec.blob ? rec.blob.size : 0 };
        });
      })).then(function (arr) { return arr.filter(Boolean); });
    });
  }

  /** 纯函数：给定索引与未引用列表 → 该删哪些、保留哪些（供单测/headless 断言） */
  function cleanupPlan(indexList, unusedNames) {
    var idx = indexList || [];
    var un = unusedNames || [];
    return {
      deleted: idx.filter(function (n) { return un.indexOf(n) >= 0; }),
      kept: idx.filter(function (n) { return un.indexOf(n) < 0; })
    };
  }

  function cleanupUnreferencedImages() {
    // 整体放进索引锁：避免与导入中的 storeImage 交错（否则刚导入的图会被当成「未引用」删掉）
    return withImgIndex(function () {
      return unreferencedImages().then(function (unused) {
        if (!unused.length) return 0;
        // 1) 先真正删除每个未引用的 Blob 记录
        return Promise.all(unused.map(function (u) {
          return Store.rawDelete('img/' + u.name).then(function (ok) {
            if (ok) {
              if (IMG_URLS[u.name]) { try { URL.revokeObjectURL(IMG_URLS[u.name]); } catch (e) { /* ignore */ } }
              delete IMG_URLS[u.name];
            }
            return ok ? u.name : null;
          });
        })).then(function (deletedList) {
          var deleted = deletedList.filter(Boolean);
          if (!deleted.length) return 0;
          // 2) 删除成功后，才把已删项从 imgIndex 剔除
          return Store.rawGet('imgIndex').then(function (list) {
            var kept = (list || []).filter(function (nm) { return deleted.indexOf(nm) < 0; });
            return Store.rawPut('imgIndex', kept).then(function () { return deleted.length; });
          });
        });
      });
    });
  }

  /* 渲染后替换 <img>：本地图库命中 → objectURL；未命中且非外链 → 未导入占位 */
  function resolveImgSrc(html) {
    if (!html || html.indexOf('<img') < 0) return html;
    return html.replace(/<img\b[^>]*>/g, function (tag) {
      var m = /src="([^"]*)"/.exec(tag);
      if (!m) return tag;
      if (/^(?:https?:|blob:|data:)/i.test(m[1])) return tag;
      var base = imgBase(m[1]);
      // data-img 供解码失败兜底用：blob URL 里已经看不出原文件名了
      if (IMG_URLS[base]) return tag.replace(/src="[^"]*"/, 'src="' + IMG_URLS[base] + '" data-img="' + ESC(base) + '"');
      return '<span class="img-missing">🖼 ' + ESC(t('img.missing')) + '：' + ESC(base) + '</span>';
    });
  }

  /* ---------- 内置题库图片（（配图 xxx）→ 内嵌图） ---------- */

  var IMG_PLACEHOLDER = /（配图\s*([^）]+?)）/g;

  /* ---------- 统计（闪记日志） ---------- */
  function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function renderStats() {
    var daily = state.daily || {};
    var total = 0;
    Object.keys(daily).forEach(function (k) { total += daily[k] || 0; });
    var streak = 0;
    var d = new Date(); d.setHours(0, 0, 0, 0);
    while ((daily[dateKey(d)] || 0) > 0) { streak++; d.setDate(d.getDate() - 1); }
    var chips = $('#statsChips');
    if (chips) {
      chips.innerHTML =
        '<span class="chip"><b>' + (daily[todayKey()] || 0) + '</b>' + t('stats.today') + '</span>' +
        '<span class="chip"><b>' + total + '</b>' + t('stats.total') + '</span>' +
        '<span class="chip"><b>' + streak + '</b>' + t('stats.streak') + '</span>';
    }
    initStatsNav();
    renderHeat(daily, statsAnchor);
    renderBars(daily, statsAnchor);
    applyStatsMode();
  }

  var HEAT_WEEKS = 26;

  function tipCount(n) { return n > 0 ? tf('stats.tipCount', { n: n }) : t('stats.tipNone'); }

  var tipTimer = null;
  function showStatTip(target) {
    var tip = $('#statTip');
    if (!tip || !target) return;
    var txt = target.getAttribute('data-tip');
    if (!txt) return;
    tip.textContent = txt;
    tip.classList.remove('hidden');
    var r = target.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70) + 'px';
    tip.style.top = Math.max(r.top - 8, 34) + 'px';
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(hideStatTip, 2600);
  }
  function hideStatTip() {
    var t = $('#statTip');
    if (t) t.classList.add('hidden');
  }

  function renderHeat(daily, anchor) {
    var box = $('#statsHeat');
    if (!box) return;
    var end = anchor ? new Date(anchor.y, anchor.m - 1, anchor.d) : new Date();
    end.setHours(0, 0, 0, 0);
    var start = new Date(end);
    start.setDate(start.getDate() - (HEAT_WEEKS * 7 - 1));
    start.setDate(start.getDate() - start.getDay()); // 对齐到周日
    var cols = Math.round((end - start) / 86400000) + 1;
    cols = Math.ceil(cols / 7);
    var months = t('stats.months').split(',');
    var monthsHtml = '';
    var prevMonth = -1;
    var grid = '<div class="heat-grid">';
    for (var c = 0; c < cols; c++) {
      var d0 = new Date(start);
      d0.setDate(d0.getDate() + c * 7);
      if (d0.getMonth() !== prevMonth) {
        prevMonth = d0.getMonth();
        monthsHtml += '<span class="hm" style="left:' + (c * 16) + 'px">' + (months[d0.getMonth()] || '') + '</span>';
      }
      grid += '<div class="heat-col">';
      for (var r = 0; r < 7; r++) {
        var dd = new Date(start);
        dd.setDate(dd.getDate() + c * 7 + r);
        if (dd > end) { grid += '<i class="heat-cell ghost"></i>'; continue; }
        var n = daily[dateKey(dd)] || 0;
        var lv = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
        var sel = anchor && dateKey(dd) === dateKey(new Date(anchor.y, anchor.m - 1, anchor.d)) ? ' sel' : '';
        grid += '<i class="heat-cell h' + lv + sel + '" data-tip="' + dateKey(dd) + ' · ' + tipCount(n) + '"></i>';
      }
      grid += '</div>';
    }
    grid += '</div>';
    box.innerHTML = '<div class="heat-scroll"><div class="heat-inner"><div class="heat-months">' + monthsHtml + '</div>' + grid + '</div></div>';
    var sc = box.querySelector('.heat-scroll');
    if (sc) sc.scrollLeft = sc.scrollWidth; // 默认停在最新一侧
  }

  function renderBars(daily, anchor) {
    var box = $('#statsBars');
    if (!box) return;
    var wds = t('stats.wds').split(',');
    var days = [];
    var endD = anchor ? new Date(anchor.y, anchor.m - 1, anchor.d) : new Date();
    endD.setHours(0, 0, 0, 0);
    var todayK = todayKey();
    for (var i = 6; i >= 0; i--) {
      var dd = new Date(endD);
      dd.setDate(dd.getDate() - i);
      var k = dateKey(dd);
      days.push({ k: k, n: daily[k] || 0, wd: dd.getDay(), today: k === todayK, sel: i === 0 && !!anchor });
    }
    var max = 1;
    days.forEach(function (x) { if (x.n > max) max = x.n; });
    var html = '<div class="bars-row">';
    days.forEach(function (x) {
      html += '<div class="bar-col' + (x.today ? ' today' : '') + (x.sel ? ' sel' : '') + '" data-tip="' + x.k + ' · ' + tipCount(x.n) + '">' +
        '<span class="bar-n">' + (x.n || '') + '</span>' +
        '<i class="bar" style="height:' + (x.n ? Math.max(Math.round(x.n / max * 100), 8) : 2) + '%"></i>' +
        '<span class="bar-wd">' + wds[x.wd] + '</span></div>';
    });
    box.innerHTML = html + '</div>';
  }

  var statsAnchor = null; // null = 窗口截至今天；{y,m,d} = 窗口截至所选日期

  function initStatsNav() {
    var ys = $('#statsY'), ms = $('#statsM'), ds = $('#statsD');
    if (!ys || ys.options.length) return;
    var now = new Date();
    var yHtml = '';
    for (var y = 2020; y <= now.getFullYear(); y++) yHtml += '<option value="' + y + '">' + y + '</option>';
    ys.innerHTML = yHtml;
    var mHtml = '';
    for (var m = 1; m <= 12; m++) mHtml += '<option value="' + m + '">' + m + '</option>';
    ms.innerHTML = mHtml;
    setStatsNavToToday();
  }

  function setStatsNavToToday() {
    var now = new Date();
    var ys = $('#statsY'), ms = $('#statsM'), ds = $('#statsD');
    if (!ys) return;
    ys.value = String(now.getFullYear());
    ms.value = String(now.getMonth() + 1);
    fillStatsDays(now.getFullYear(), now.getMonth() + 1);
    ds.value = String(now.getDate());
    statsAnchor = null;
  }

  function fillStatsDays(y, m) {
    var ds = $('#statsD');
    if (!ds) return;
    var days = new Date(y, m, 0).getDate();
    var keep = parseInt(ds.value, 10) || 1;
    var html = '';
    for (var d = 1; d <= days; d++) html += '<option value="' + d + '">' + d + '</option>';
    ds.innerHTML = html;
    ds.value = String(Math.min(keep, days));
  }

  function onStatsNavChange(changed) {
    var ys = $('#statsY'), ms = $('#statsM'), ds = $('#statsD');
    if (!ys || !ms || !ds) return;
    var y = parseInt(ys.value, 10), m = parseInt(ms.value, 10);
    if (changed !== 'statsD') fillStatsDays(y, m);
    statsAnchor = { y: y, m: m, d: parseInt(ds.value, 10) || 1 };
    renderStatsCharts();
  }

  function renderStatsCharts() {
    renderHeat(state.daily || {}, statsAnchor);
    renderBars(state.daily || {}, statsAnchor);
    applyStatsMode();
  }

  function applyStatsMode() {
    var mode = state.settings.statsView === 'bars' ? 'bars' : 'heat';
    var heat = $('#statsHeat'), bars = $('#statsBars');
    if (heat) heat.classList.toggle('hidden', mode !== 'heat');
    if (bars) bars.classList.toggle('hidden', mode !== 'bars');
    $$('#view-stats .seg-btn').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
    });
    // 图表在隐藏状态下渲染时滚动不生效，切回可见后把选中格/最新处滚进视野
    if (mode === 'heat' && heat) {
      var sc = heat.querySelector('.heat-scroll');
      var selCell = heat.querySelector('.heat-cell.sel');
      requestAnimationFrame(function () {
        if (selCell && selCell.scrollIntoView) selCell.scrollIntoView({ block: 'nearest', inline: 'center' });
        else if (sc) sc.scrollLeft = sc.scrollWidth;
      });
    }
  }

  /* ---------- 标签与排序 ---------- */
  function collectTags() {
    var set = {};
    state.decks.forEach(function (d) {
      (d.tags || []).forEach(function (tg) { set[tg] = (set[tg] || 0) + 1; });
      d.cards.forEach(function (c) {
        (c.tags || []).forEach(function (tg) { set[tg] = (set[tg] || 0) + 1; });
      });
    });
    return set;
  }

  function applyHomeFilterSort(decks) {
    var tag = state.settings.tagFilter || '';
    var sort = state.settings.deckSort || 'recent';
    var list = decks.slice();
    if (tag) {
      list = list.filter(function (d) {
        return (d.tags || []).indexOf(tag) >= 0 || d.cards.some(function (c) { return (c.tags || []).indexOf(tag) >= 0; });
      });
    }
    list.sort(function (a, b) {
      if (sort === 'name') return String(a.name).localeCompare(String(b.name), 'zh');
      if (sort === 'cards') return b.cards.length - a.cards.length;
      if (sort === 'due') return dueOfDeck(b) - dueOfDeck(a);
      return (b.createdAt || 0) - (a.createdAt || 0); // recent
    });
    return list;
  }

  function dueOfDeck(d) {
    var n = 0;
    d.cards.forEach(function (c) { if (isDueStat(state.stats[c.id])) n++; });
    return n;
  }

  /* ---------- 卡片操作（写前快照 → 一级撤销） ---------- */
  var lastOpSnapshot = null;
  function snapshotForUndo() {
    try { lastOpSnapshot = JSON.stringify({ decks: state.decks, stats: state.stats }); } catch (e) { lastOpSnapshot = null; }
  }
  function undoLastCardOp() {
    if (!lastOpSnapshot) { toast(t('card.noUndo')); return; }
    try {
      var snap = JSON.parse(lastOpSnapshot);
      state.decks = snap.decks;
      state.stats = snap.stats;
      lastOpSnapshot = null;
      flushSave();
      renderHome();
      if ($('#view-browse').classList.contains('active') && browse.deckId) renderBrowse();
      toast(t('card.undone'));
    } catch (e) { toast(t('card.noUndo')); }
  }

  function openCardEdit(deckId, cardId) {
    var d = findDeck(deckId);
    var c = d && d.cards.filter(function (x) { return x.id === cardId; })[0];
    if (!c) return;
    openModal(
      '<h3>' + t('card.editTitle') + '</h3>' +
      '<div class="field"><label>' + t('card.fTitle') + '</label><input type="text" id="ceTitle" value="' + ESC(c.title) + '"></div>' +
      '<div class="field"><label>' + t('card.fQuestion') + '</label><textarea id="ceQ" rows="2">' + ESC(c.question) + '</textarea></div>' +
      '<div class="field"><label>' + t('card.fAnswer') + '</label><textarea id="ceA" rows="7">' + ESC(c.answer) + '</textarea></div>' +
      '<p class="modal-note">' + t('card.editNote') + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="card-edit-save" data-deck="' + deckId + '" data-card="' + cardId + '">' + t('btn.save') + '</button>' +
      '</div>'
    );
  }

  function saveCardEdit(deckId, cardId) {
    var d = findDeck(deckId);
    var c = d && d.cards.filter(function (x) { return x.id === cardId; })[0];
    if (!c) { closeModal(); toast(t('card.noUndo')); return; } // 陈旧 id：卡片已不存在
    var nt = ($('#ceTitle') || {}).value || '';
    var nq = ($('#ceQ') || {}).value || '';
    var na = ($('#ceA') || {}).value || '';
    if (!na.trim()) { toast(t('card.answerRequired')); return; }
    if (!window.confirm(t('card.editConfirm'))) return;
    snapshotForUndo();
    // 优先写回源 Markdown：旧答案能在 raw 中唯一定位时同步替换
    var wroteRaw = false;
    if (d.raw && c.answer && d.raw.indexOf(c.answer) >= 0 && d.raw.indexOf(c.answer) === d.raw.lastIndexOf(c.answer)) {
      d.raw = d.raw.split(c.answer).join(na);
      wroteRaw = true;
    }
    var newId = 'c' + Core.hash32(nt + '|' + nq + '|' + na);
    if (state.stats[cardId] && !state.stats[newId]) state.stats[newId] = state.stats[cardId]; // 进度随内容迁移
    if (newId !== cardId) delete state.stats[cardId];
    c.title = nt; c.question = nq; c.answer = na;
    c.modified = true; // 卡片上标「已修改」
    c.id = newId;
    closeModal();
    flushSave();
    renderBrowse();
    renderHome();
    toast(wroteRaw ? t('card.savedRaw') : t('card.savedLocal'), 2400);
  }

  function openCardSplit(deckId, cardId) {
    var d = findDeck(deckId);
    var c = d && d.cards.filter(function (x) { return x.id === cardId; })[0];
    if (!c) return;
    openModal(
      '<h3>' + t('card.splitTitle') + '</h3>' +
      '<p class="modal-note">' + t('card.splitNote') + '</p>' +
      '<div class="field"><textarea id="csA" rows="8">' + ESC(c.answer) + '</textarea></div>' +
      '<p class="modal-note">' + t('card.splitHint') + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="card-split-do" data-deck="' + deckId + '" data-card="' + cardId + '">' + t('card.splitDo') + '</button>' +
      '</div>'
    );
    var ta = $('#csA');
    if (ta) {
      ta.focus();
      var mid = Math.floor(ta.value.length / 2);
      var brk = ta.value.indexOf('\n', mid);
      if (brk > 0) ta.setSelectionRange(brk + 1, brk + 1);
    }
  }

  function doCardSplit(deckId, cardId) {
    var d = findDeck(deckId);
    var ci = d ? d.cards.findIndex(function (x) { return x.id === cardId; }) : -1;
    if (ci < 0) { closeModal(); toast(t('card.noUndo')); return; }
    var c = d.cards[ci];
    var ta = $('#csA');
    var pos = ta ? (ta.selectionStart || Math.floor(ta.value.length / 2)) : Math.floor(c.answer.length / 2);
    var a1 = c.answer.slice(0, pos).trim();
    var a2 = c.answer.slice(pos).trim();
    if (!a1 || !a2) { toast(t('card.splitFail')); return; }
    if (!window.confirm(t('card.splitConfirm'))) return;
    snapshotForUndo();
    var id1 = 'c' + Core.hash32(c.title + '|' + c.question + '|' + a1);
    if (state.stats[cardId] && !state.stats[id1]) state.stats[id1] = state.stats[cardId]; // 进度留在前半张
    if (id1 !== cardId) delete state.stats[cardId];
    c.answer = a1;
    c.id = id1;
    d.cards.splice(ci + 1, 0, {
      id: 'c' + Core.hash32((c.title + '·2') + '|' + c.question + '|' + a2),
      title: c.title, question: c.question, answer: a2, path: c.path.slice(), chapter: c.chapter, modified: true
    });
    closeModal();
    flushSave();
    renderBrowse();
    toast(t('card.splitDone'));
  }

  function doCardMerge(deckId, cardId) {
    var d = findDeck(deckId);
    var ci = d ? d.cards.findIndex(function (x) { return x.id === cardId; }) : -1;
    if (ci < 0) { toast(t('card.noUndo')); return; }
    if (ci + 1 >= d.cards.length) { toast(t('card.mergeFail')); return; }
    var c = d.cards[ci], nx = d.cards[ci + 1];
    if (!window.confirm(t('card.mergeConfirm'))) return;
    snapshotForUndo();
    var newId = 'c' + Core.hash32(c.title + '|' + c.question + '|' + c.answer + '\n\n' + nx.answer);
    if (state.stats[cardId] && !state.stats[newId]) state.stats[newId] = state.stats[cardId];
    if (newId !== cardId) delete state.stats[cardId];
    c.answer = c.answer + '\n\n' + nx.answer;
    c.modified = true;
    c.id = newId;
    // 下一张的进度：被其他笔记共享时保留，本笔记独有时清掉
    var shared = state.decks.some(function (x) {
      return x.id !== d.id && x.cards.some(function (cc) { return cc.id === nx.id; });
    });
    if (!shared) delete state.stats[nx.id];
    d.cards.splice(ci + 1, 1);
    flushSave();
    renderBrowse();
    toast(t('card.mergeDone'));
  }

  function openCardMove(deckId, cardId) {
    var d = findDeck(deckId);
    var c = d && d.cards.filter(function (x) { return x.id === cardId; })[0];
    if (!c) return;
    var opts = state.decks.map(function (x) { return '<option value="' + x.id + '"' + (x.id === deckId ? ' selected' : '') + '>' + ESC(x.name) + '</option>'; }).join('');
    openModal(
      '<h3>' + t('card.moveTitle') + '</h3>' +
      '<div class="field"><label>' + t('card.moveDeck') + '</label><select id="cmDeck">' + opts + '</select></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="card-move-do" data-deck="' + deckId + '" data-card="' + cardId + '">' + t('btn.save') + '</button>' +
      '</div>'
    );
  }

  function doCardMove(fromDeck, cardId) {
    var fd = findDeck(fromDeck);
    var td = findDeck(($('#cmDeck') || {}).value);
    var ci = fd ? fd.cards.findIndex(function (x) { return x.id === cardId; }) : -1;
    if (ci < 0 || !td) return;
    if (td.id === fd.id) { closeModal(); return; }
    if (!window.confirm(t('card.moveConfirm'))) return;
    snapshotForUndo();
    var c = fd.cards.splice(ci, 1)[0];
    td.cards.push(c);
    c.modified = true;
    closeModal();
    flushSave();
    renderBrowse();
    renderHome();
    toast(t('card.moveDone'));
  }

  /* ---------- 全局搜索（跨笔记：标题/问题/答案/章节） ---------- */
  var searchAllTimer = null;
  function globalSearch(qs) {
    var q = String(qs || '').trim().toLowerCase();
    var out = [];
    if (!q) return out;
    state.decks.forEach(function (d) {
      d.cards.forEach(function (c) {
        var hay = [c.title, c.question, c.answer, (c.path || []).join('/'), c.chapter || ''].join('\n').toLowerCase();
        var idx = hay.indexOf(q);
        if (idx < 0) return;
        // 命中片段：找答案/问题里的原文位置
        var src = [c.title, c.question, c.answer].join(' ');
        var si = src.toLowerCase().indexOf(q);
        var snip = si >= 0 ? src.slice(Math.max(0, si - 18), si + q.length + 30) : src.slice(0, 46);
        out.push({ deckId: d.id, deckName: d.name, card: c, snippet: snip });
        if (out.length >= 60) return;
      });
    });
    return out;
  }

  function runGlobalSearch() {
    var box = $('#gsResults');
    var q = ($('#globalSearch') || {}).value || '';
    if (!box) return;
    if (!q.trim()) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    var hits = globalSearch(q);
    box.classList.remove('hidden');
    if (!hits.length) {
      box.innerHTML = '<p class="muted" style="padding:10px 4px">' + ESC(t('search.empty')) + '</p>';
      return;
    }
    box.innerHTML = hits.slice(0, 30).map(function (h, i) {
      return '<div class="gs-row" data-act="gs-open" data-i="' + i + '">' +
        '<div class="gs-meta">' + ESC(h.deckName) + (h.card.chapter ? ' · ' + ESC(h.card.chapter) : '') + '</div>' +
        '<div class="gs-snip">' + ESC(h.snippet) + '</div></div>';
    }).join('') + (hits.length > 30 ? '<p class="muted" style="padding:6px">' + tf('search.more', { n: hits.length - 30 }) + '</p>' : '');
    window.__gsHits = hits;
  }

  function openGsCard(i) {
    var h = (window.__gsHits || [])[i];
    if (!h) return;
    openModal(
      '<h3>' + ESC(h.card.title || h.deckName) + '</h3>' +
      '<p class="modal-note">' + ESC(h.deckName) + (h.card.chapter ? ' · ' + ESC(h.card.chapter) : '') + '</p>' +
      (h.card.question ? '<div class="gs-q">' + ESC(String(h.card.question).slice(0, 200)) + '</div>' : '') +
      '<div class="gs-a">' + resolveImgSrc(Core.renderMarkdown(h.card.answer)) + '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.close') + '</button>' +
        '<button class="btn" data-act="gs-review" data-deck="' + h.deckId + '" data-card="' + h.card.id + '">' + t('search.reviewFrom') + '</button>' +
        '<button class="btn primary" data-act="gs-browse" data-deck="' + h.deckId + '" data-card="' + h.card.id + '">' + t('search.openDeck') + '</button>' +
      '</div>'
    );
  }

  /* ---------- 检查更新（读仓库根目录的 latest.json，经 jsDelivr CDN，带 CORS） ---------- */
  var UPDATE_JSON_URLS = [
    'https://fastly.jsdelivr.net/gh/fest77/flash-memory-cards@main/latest.json',
    'https://gcore.jsdelivr.net/gh/fest77/flash-memory-cards@main/latest.json',
    'https://testingcf.jsdelivr.net/gh/fest77/flash-memory-cards@main/latest.json',
    'https://cdn.jsdelivr.net/gh/fest77/flash-memory-cards@main/latest.json',
    'https://raw.githubusercontent.com/fest77/flash-memory-cards/main/latest.json'
  ];
  var RELEASES_URL = 'https://gitee.com/festeel/flash-memory-cards/releases';

  function compareVer(a, b) {
    var pa = String(a || '').replace(/^v/i, '').split('.');
    var pb = String(b || '').replace(/^v/i, '').split('.');
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = parseInt(pa[i], 10) || 0;
      var y = parseInt(pb[i], 10) || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  function fetchLatest(i) {
    if (i >= UPDATE_JSON_URLS.length) return Promise.reject(new Error('unreachable'));
    return fetch(UPDATE_JSON_URLS[i], { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).catch(function () { return fetchLatest(i + 1); });
  }

  function checkUpdate() {
    var btn = $('#checkUpdateBtn');
    var oldTxt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = t('update.checking'); }
    fetchLatest(0).then(function (data) {
      if (btn) { btn.disabled = false; btn.textContent = oldTxt; }
      var remote = String((data && data.version) || '').replace(/^v/i, '').trim();
      if (!/^\d+(\.\d+)*$/.test(remote)) throw new Error('bad version');
      if (compareVer(remote, APP_VERSION) <= 0) {
        toast(t('update.latest'), 3000);
        return;
      }
      openModal(
        '<h3>' + ESC(tf('update.newTitle', { v: remote })) + '</h3>' +
        '<p class="modal-note">' + ESC(tf('update.newBody', { cur: APP_VERSION })) + '</p>' +
        '<div class="modal-actions">' +
          '<button class="btn" data-act="close-modal">' + t('update.no') + '</button>' +
          '<button class="btn primary" data-act="update-go">' + t('update.yes') + '</button>' +
        '</div>'
      );
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = oldTxt; }
      toast(t('update.fail'), 4000);
    });
  }

  function deckImageSet(deck) {
    var all = window.MDReviewBundledImages;
    if (!all || !deck || !deck.name) return null;
    return all[deck.name] || null;
  }

  /* ---------- 数学公式（KaTeX 本地内联；无公式不渲染；失败原样显示） ---------- */
  function renderMathSegments(md) {
    var segs = [];
    if (!window.katex || String(md || '').indexOf('$') < 0) return { text: md, segs: segs };
    var text = String(md);
    // 1) 先保护代码（围栏与行内代码里的 $ 不是公式）
    var codeSegs = [];
    var protect = function (code) {
      codeSegs.push(code);
      return '\u0003C' + (codeSegs.length - 1) + '\u0004';
    };
    text = text.replace(/```[\s\S]*?```/g, function (m) { return protect(m); });
    text = text.replace(/`[^`\n]+`/g, function (m) { return protect(m); });
    // 2) 公式提取：$$...$$（display），然后 $...$（inline）
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, function (m, tex) {
      var html = null;
      try { html = window.katex.renderToString(tex, { displayMode: true, throwOnError: false }); } catch (e) { html = null; }
      segs.push(html || ('<code>' + ESC(tex) + '</code>'));
      return '\u0001M' + (segs.length - 1) + '\u0002';
    });
    text = text.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, function (m, pre, tex) {
      // 货币/中文内容不当公式（判定逻辑在 core.isMathCandidate，可单测）
      if (!Core.isMathCandidate(tex)) return m;
      var html = null;
      try { html = window.katex.renderToString(tex, { displayMode: false, throwOnError: false }); } catch (e) { html = null; }
      segs.push(html || ('<code>' + ESC(tex) + '</code>'));
      return pre + '\u0001M' + (segs.length - 1) + '\u0002';
    });
    // 3) 还原代码（renderMarkdown 自己处理代码块与高亮）
    text = text.replace(/\u0003C(\d+)\u0004/g, function (m, i) {
      return codeSegs[+i] != null ? codeSegs[+i] : m;
    });
    return { text: text, segs: segs };
  }

  function restoreMath(html, segs) {
    if (!segs || !segs.length) return html;
    return html.replace(/\u0001M(\d+)\u0002/g, function (m, i) {
      return segs[+i] != null ? segs[+i] : m;
    });
  }

  /* ---------- 轻量代码高亮（常见语言；纯本地正则分词） ---------- */
  var HL_KEYWORDS = {
    js: 'var let const function return if else for while class new extends import export from default async await try catch throw typeof instanceof this null undefined true false break continue switch case do delete in of void yield static get set',
    java: 'public private protected class interface extends implements static final void int long double float boolean char byte short new return if else for while do switch case break continue try catch finally throw throws import package this super null true false abstract synchronized volatile transient enum record var',
    python: 'def class return if elif else for while break continue pass import from as try except finally raise with lambda yield global nonlocal assert del in is not and or None True False self async await print',
    c: 'int char float double void long short unsigned signed struct union enum typedef static const return if else for while do switch case break continue goto sizeof public private protected class new namespace using template typename virtual override nullptr true false auto',
    go: 'func package import var const type struct interface map chan go defer return if else for range switch case break continue select nil true false string int int64 float64 bool byte rune error make new len cap append',
    sql: 'select from where and or not null is in like between join left right inner outer on group by order having limit offset insert into values update set delete create table drop alter index view as distinct count sum avg min max union all case when then else end exists primary key foreign references',
    bash: 'if then else elif fi for while do done case esac in function return exit echo local export readonly shift trap set unset source alias sudo apt cd ls cp mv rm mkdir cat grep sed awk chmod curl wget git npm node python pip docker',
    css: 'important media supports keyframes from to and not only screen print hover focus active before after root var calc rgb rgba hsl linear-gradient flex grid absolute relative fixed sticky',
    html: ''
  };
  var HL_ALIAS = { javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', json: 'js', node: 'js',
    py: 'python', cxx: 'c', cpp: 'c', 'c++': 'c', cs: 'c', csharp: 'c', kotlin: 'java', kt: 'java', dart: 'java', swift: 'c', rust: 'c', rs: 'c',
    golang: 'go', mysql: 'sql', postgresql: 'sql', sqlite: 'sql', shell: 'bash', sh: 'bash', zsh: 'bash', powershell: 'bash' };

  function highlightCode(code, lang) {
    var key = HL_ALIAS[String(lang || '').toLowerCase()] || String(lang || '').toLowerCase();
    var kws = (HL_KEYWORDS[key] || '').split(/\s+/).filter(Boolean);
    // 注释正则（单正则内部 alternation，不要写成两个正则的位或）
    var commentRe = (key === 'python' || key === 'bash')
      ? /#[^\n]*/
      : (key === 'sql')
        ? /--[^\n]*|\/\*[\s\S]*?\*\//
        : /\/\/[^\n]*|\/\*[\s\S]*?\*\//;
    var parts = [];
    // src 已 ESC 过：plain 直接入栈，二次 ESC 会让 < > & 以实体形式显示出来
    var plain = function (t) { parts.push(t); };
    // src 已经 ESC 过：命中片段直接入 span，不再二次转义
    var push = function (cls, t) { parts.push('<span class="hl-' + cls + '">' + t + '</span>'); };
    var re = new RegExp(
      (commentRe.source ? '(' + commentRe.source + ')' : '(\\u0000)') + // 1 注释
      '|(&quot;(?:[^&\\n]|&(?!quot;))*?&quot;|&#39;[^\\n]*?&#39;|`[^`\\n]*`)' + // 2 字符串（已转义）
      '|\\b(\\d+(?:\\.\\d+)?)\\b' + // 3 数字
      (kws.length ? '|\\b(' + kws.join('|') + ')\\b' : '') // 4 关键字
      , 'g');
    var src = ESC(code);
    var last = 0, m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) plain(src.slice(last, m.index));
      if (m[1]) push('cmt', m[1]);
      else if (m[2]) push('str', m[2]);
      else if (m[3]) push('num', m[3]);
      else if (m[4]) push('kw', m[4]);
      else plain(m[0]);
      last = m.index + m[0].length;
    }
    if (last < src.length) plain(src.slice(last));
    return parts.join('');
  }

  /* Obsidian [[wikilink]]：目标卡片存在则可点击跳到浏览页定位，否则保持原样文字 */
  function linkWikiCards(html) {
    if (!html || html.indexOf('[[', 0) < 0) return html;
    var titleMap = {};
    state.decks.forEach(function (d) {
      d.cards.forEach(function (c) {
        var tt = String(c.title || '').trim();
        if (tt) titleMap[tt] = { deckId: d.id, cardId: c.id };
      });
    });
    return html.replace(/\[\[([^\]\n|]+)\]\]/g, function (m, target) {
      var hit = titleMap[String(target).trim()];
      return hit
        ? '<a href="#" class="wikilink" data-act="wiki-jump" data-deck="' + hit.deckId + '" data-card="' + hit.cardId + '">' + ESC(String(target).trim()) + '</a>'
        : m; // 目标不存在：原样显示
    });
  }

  function renderAnswerHtml(markdown, deck) {
    var mm = renderMathSegments(markdown);
    var html = Core.renderMarkdown(mm.text);
    html = restoreMath(html, mm.segs);
    html = linkWikiCards(html);
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
      '<button class="chip ' + (filter === 'todo' ? 'on' : '') + '" data-act="set-filter" data-filter="todo">' + tf('home.todoCards', { n: todoCountAll() }) + '</button>' +
      '<span class="chip">' + tf('home.today', { n: today }) + '</span>' +
      '<span class="chip due">' + tf('home.due', { n: dueCountAll() }) + '</span>';

    var hasDecks = state.decks.length > 0;
    $('#heroEmpty').classList.toggle('hidden', hasDecks);
    $('#homeBody').classList.toggle('hidden', !hasDecks);

    var bb = $('#backupBar');
    if (bb) {
      var need = state.decks.length && state.lastChangeAt &&
        (state.lastChangeAt - (state.lastBackupAt || 0) > 7 * 86400000) &&
        (state.lastChangeAt - (state.backupRemindDismissedAt || 0) > 7 * 86400000);
      bb.innerHTML = need
        ? '<div class="backup-remind"><span>' + ESC(t('backup.remind')) + '</span>' +
          '<button class="btn sm primary" data-act="backup-now">' + ESC(t('backup.now')) + '</button>' +
          '<button class="btn sm ghost" data-act="backup-remind-dismiss">×</button></div>'
        : '';
    }
    pruneEmptySession();
    var rs = state.reviewSession;
    var rb = $('#resumeBar');
    if (rb) {
      var remain = sessionRemaining();
      rb.innerHTML = (rs && remain > 0)
        ? '<button class="btn primary" data-act="resume-review">' + ESC(tf('home.resume', { name: rs.deckName, n: remain })) + '</button>'
        : '';
    }

    if (!hasDecks) {
      $('#deckList').innerHTML = '';
      return;
    }

    var tags = collectTags();
    var tagBar = $('#tagBar');
    if (tagBar) {
      var curTag = state.settings.tagFilter || '';
      var keys = Object.keys(tags).sort();
      tagBar.innerHTML = keys.length
        ? keys.map(function (tg) {
            return '<button class="chip ' + (curTag === tg ? 'on' : '') + '" data-act="tag-filter" data-tag="' + ESC(tg) + '">' + ESC(tg) + ' <b>' + tags[tg] + '</b></button>';
          }).join('')
        : '';
    }
    var html = applyHomeFilterSort(state.decks).map(function (d) {
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
            (aiRun.lastRefine && aiRun.lastRefine.deckId === d.id && !aiRun.lastRefine.undone
              ? '<button class="btn sm" data-act="ai-undo" data-deck="' + d.id + '">' + t('ai.undo') + '</button>'
              : '') +
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
    lastOpSnapshot = null; // 导入后撤销快照失效
    var b = behavior || {};
    if (!text || text.trim().length < 10) {
      if (!b.silent) toast(t('toast.tooShort'));
      return false;
    }
    var opts = currentOpts(override);
    var deck = Core.buildDeck(name, text, { mode: opts.mode, maxCardLen: opts.maxCardLen, qstyle: opts.qstyle, lang: state.settings.lang });
    // 标签：frontmatter tags: a, b（deck 级）+ 行内 #tag（卡片级）
    var fm = /^---\n([\s\S]*?)\n---/.exec(String(text || ''));
    if (fm && /^tags?:/m.test(fm[1])) {
      var tgLine = fm[1].match(/^tags?:\s*(.+)$/m);
      if (tgLine) {
        deck.tags = tgLine[1].replace(/[\[\]'"']/g, '').split(/[,，]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
      }
    }
    deck.cards.forEach(function (c) {
      var tags = [];
      String(c.answer + ' ' + c.question).replace(/(^|\s)#([\w\u4e00-\u9fa5-]{1,24})/g, function (m, pre, tg) {
        if (tags.indexOf(tg) < 0) tags.push(tg);
        return m;
      });
      if (tags.length) c.tags = tags;
    });
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
        var pathMap = {}; // zip 内完整路径 → 实际存储名
        return importImageEntries(imgs, pathMap).then(function (nImg) {
          if (!texts.length && !nImg) { toast(t('toast.zipEmpty')); return; }
          texts.forEach(function (en) {
            var base = en.name.split('/').pop();
            var dir = en.name.indexOf('/') >= 0 ? en.name.slice(0, en.name.lastIndexOf('/') + 1) : '';
            var text = Core.decodeBytes(en.bytes);
            // 按路径重写引用：不同子目录可以有同名图片（img001.png ×3），只按文件名替换会串图
            text = rewriteZipImageRefs(text, dir, pathMap);
            importQueue.push({ name: base.replace(/\.[^.]+$/, ''), text: text, size: en.bytes.length, source: en.name });
          });
          renderImportQueue();
          var msg = '';
          if (texts.length) msg += tf('toast.zipTaken', { n: texts.length });
          if (nImg) msg += (msg ? '，' : '') + tf('toast.imgTaken', { n: nImg });
          if (imgs.length && nImg < imgs.length) msg += (msg ? '，' : '') + tf('toast.imgLost', { n: imgs.length - nImg });
          if (msg) toast(msg, 3200);
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

  function aiChat(messages, maxTokens, useProvider) {
    var p = useProvider || activeProvider();
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
    // 显式以该供应商发起一次最小请求（不影响「当前使用」，停用的也能测）
    aiChat([{ role: 'user', content: '只回复两个字：可用' }], 32, p).then(function (text) {
      var out = $('#aiTestOut');
      if (out) out.innerHTML = '<b class="ok">' + t('ai.testOk') + '</b><br>' + ESC(t('ai.modelReply')) + ESC(String(text).slice(0, 120));
    }).catch(function (err) {
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

    aiRun = { active: true, cancel: false, done: 0, total: cards.length, snapshot: cards.map(function (c) { return c.question; }) };
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
      var canceled = aiRun.cancel;
      aiRun.active = false;
      if (changed && aiRun.snapshot) {
        aiRun.lastRefine = { deckId: d.id, snapshot: aiRun.snapshot, undone: false }; // 撤销入口放到首页，关掉弹窗仍可用
      }
      scheduleSave();
      renderHome();
      var out = $('#aiOut');
      var msg = canceled ? t('ai.canceled')
        : (errors.length ? tf('ai.doneFail', { n: changed, m: errors.length }) : tf('ai.done', { n: changed }));
      if (out) {
        out.innerHTML = '<b class="' + (canceled ? 'warn' : 'ok') + '">' + ESC(msg) + '</b>' +
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

  function collectReviewItems(deckIds, o) {
    var out = [];
    deckIds.forEach(function (id) {
      var d = findDeck(id);
      if (!d) return;
      d.cards.forEach(function (c) {
        if (o.filter === 'todo' && !isTodoStat(state.stats[c.id])) return;
        if (o.scope === 'weak' && !isWeakStat(state.stats[c.id])) return;
        if (o.chapter && chapterOf(c) !== o.chapter) return;
        out.push({ card: c, deckId: id, deckName: d.name });
      });
    });
    return out;
  }

  function sessionRemaining() {
    var rs = state.reviewSession;
    if (!rs) return 0;
    return rs.queueIds.length + rs.round2Ids.length + (rs.currentId ? 1 : 0);
  }

  // 队列/二轮/当前全空的会话是残留，直接清掉（并落盘）
  function pruneEmptySession() {
    if (state.reviewSession && sessionRemaining() <= 0) {
      state.reviewSession = null;
      flushSave();
    }
  }

  function startReview(deckIds, opts) {
    var o = (typeof opts === 'string') ? { filter: opts } : (opts || {});
    var startCardId = o.startCard || null;
    var hadSession = !!state.reviewSession;
    lastOpSnapshot = null; // 复习/导入后卡片操作快照失效
    pruneEmptySession();
    if (state.reviewSession === null && hadSession) flushSave(); // 清空残会话也落盘
    var remain = sessionRemaining();
    if (remain > 0 && !o.resumeOk) {
      if (!window.confirm(tf('confirm.newSession', { n: remain }))) return;
      state.reviewSession = null;
      flushSave(); // 确认覆盖：立即落盘，强杀也不丢状态一致性
    }
    var items = collectReviewItems(deckIds, o);
    if (!items.length) {
      toast(o.scope === 'weak' ? t('review.noWeak') : (o.filter === 'todo' || o.filter === 'todoonly' ? t('review.noTodo') : t('review.noCards')));
      return;
    }
    // 到期优先：到期卡洗牌后排前面，未到期排后面；数量限制时优先留下到期的
    if (o.count && items.length > o.count) {
      shuffle(items);
      var due = [], not = [];
      items.forEach(function (it) {
        if (isDueStat(state.stats[it.card.id])) due.push(it); else not.push(it);
      });
      items = due.concat(not).slice(0, o.count);
    } else {
      shuffle(items);
    }
    review = {
      deckIds: deckIds.slice(),
      filter: o.filter || 'all',
      scope: o.scope || 'all',
      chapter: o.chapter || '',
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
    if (startCardId) {
      for (var qi = 0; qi < review.queue.length; qi++) {
        if (review.queue[qi].card.id === startCardId) {
          review.queue.unshift(review.queue.splice(qi, 1)[0]);
          break;
        }
      }
    }
    $('#rvAnswer').innerHTML = '';
    saveReviewSession();
    flushSave(); // 新会话立即落盘：pagehide 前被强杀也不丢
    showView('review');
    nextCard();
  }

  /* ---------- 复习设置弹窗（数量 / 范围 / 章节） ---------- */
  function openReviewSetup(deckId) {
    var d = findDeck(deckId);
    if (!d) return;
    var chs = [];
    d.cards.forEach(function (c) {
      var g = chapterOf(c);
      if (chs.indexOf(g) < 0) chs.push(g);
    });
    openModal(
      '<h3>' + t('review.setupTitle') + '</h3>' +
      '<div class="field"><label>' + t('review.count') + '</label>' +
        '<div class="seg-row">' +
          '<label class="seg-opt"><input type="radio" name="rvCount" value="20">' + t('review.limit20') + '</label>' +
          '<label class="seg-opt"><input type="radio" name="rvCount" value="50">' + t('review.limit50') + '</label>' +
          '<label class="seg-opt"><input type="radio" name="rvCount" value="all" checked>' + t('review.limitAll') + '</label>' +
        '</div></div>' +
      '<div class="field"><label>' + t('review.scope') + '</label>' +
        '<div class="seg-row">' +
          '<label class="seg-opt"><input type="radio" name="rvScope" value="all" checked>' + t('review.scopeAll') + '</label>' +
          '<label class="seg-opt"><input type="radio" name="rvScope" value="weak">' + t('review.weak') + '</label>' +
        '</div></div>' +
      '<div class="field"><label for="rvChapterSel">' + t('review.chapters') + '</label>' +
        '<select id="rvChapterSel"><option value="">' + t('review.chAll') + '</option>' +
          chs.map(function (c) { return '<option value="' + ESC(c) + '">' + ESC(c) + '</option>'; }).join('') +
        '</select></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="review-start" data-deck="' + d.id + '">' + t('review.start') + '</button>' +
      '</div>'
    );
    modalPayload = { deckId: d.id };
  }

  function currentRoundTotal() {
    return review ? review.total : 0;
  }

  function sessionIds(arr) { return arr.map(function (x) { return x.card.id; }); }

  function saveReviewSession() {
    if (!review) return;
    // 会话直接写入 state 并立即落盘：复习中途退出/刷新不能丢（防抖 250ms 可能赶不上）
    var u = review.undo;
    state.reviewSession = {
      deckIds: review.deckIds.slice(),
      filter: review.filter,
      deckName: review.deckName,
      phase: review.phase,
      total: review.total,
      rated: review.rated,
      okCount: review.okCount,
      fuzzyCount: review.fuzzyCount,
      badCount: review.badCount,
      queueIds: sessionIds(review.queue),
      round2Ids: sessionIds(review.round2),
      currentId: review.current ? review.current.card.id : null,
      undo: u ? {
        cardId: u.cardId, stat: u.stat,
        queueIds: sessionIds(u.queue), round2Ids: sessionIds(u.round2),
        phase: u.phase, rated: u.rated, okCount: u.okCount, fuzzyCount: u.fuzzyCount, badCount: u.badCount, total: u.total
      } : null,
      savedAt: Date.now()
    };
  }

  function clearReviewSession() {
    state.reviewSession = null;
  }

  function resolveItem(cardId) {
    var ids = (state.reviewSession && state.reviewSession.deckIds) || (review ? review.deckIds : []);
    for (var i = 0; i < ids.length; i++) {
      var d = findDeck(ids[i]);
      if (!d) continue;
      for (var j = 0; j < d.cards.length; j++) {
        if (d.cards[j].id === cardId) return { card: d.cards[j], deckId: d.id, deckName: d.name };
      }
    }
    return null;
  }

  function resumeReview() {
    var ss = state.reviewSession;
    if (!ss) return;
    var gone = false;
    var mk = function (id) { var it = resolveItem(id); if (!it) gone = true; return it; };
    var queue = ss.queueIds.map(mk).filter(Boolean);
    var round2 = ss.round2Ids.map(mk).filter(Boolean);
    var undo = null;
    if (ss.undo) {
      undo = {
        cardId: ss.undo.cardId, stat: ss.undo.stat,
        queue: ss.undo.queueIds.map(mk).filter(Boolean),
        round2: ss.undo.round2Ids.map(mk).filter(Boolean),
        phase: ss.undo.phase, rated: ss.undo.rated, okCount: ss.undo.okCount,
        fuzzyCount: ss.undo.fuzzyCount, badCount: ss.undo.badCount, total: ss.undo.total
      };
    }
    if (gone || (ss.currentId && !resolveItem(ss.currentId))) { // 有卡片（含当前卡）被删除：会话失效
      state.reviewSession = null;
      flushSave();
      toast(t('review.sessionGone'));
      renderHome();
      return;
    }
    review = {
      deckIds: ss.deckIds.slice(),
      filter: ss.filter,
      deckName: ss.deckName,
      phase: ss.phase,
      queue: queue,
      round2: round2,
      total: ss.total,
      rated: ss.rated,
      okCount: ss.okCount,
      fuzzyCount: ss.fuzzyCount,
      badCount: ss.badCount,
      current: null,
      revealed: false,
      undo: undo
    };
    $('#rvSummary').classList.add('hidden');
    $('#rvCard').classList.remove('hidden');
    $('#rvAnswer').innerHTML = '';
    showView('review');
    if (ss.currentId) {
      var cur = resolveItem(ss.currentId);
      if (cur) { review.current = cur; review.revealed = false; renderCard(); return; }
    }
    nextCard();
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
    saveReviewSession();
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
    var ub = $('#undoRateBtn');
    if (ub) ub.classList.toggle('hidden', !review.undo);

    var pathParts = [];
    if (review.deckIds.length > 1) pathParts.push(q.deckName);
    (card.path || []).forEach(function (p) { pathParts.push(p); });
    $('#rvPath').textContent = pathParts.join('  /  ');
    var tEl = $('#rvTitle');
    var tText = card.title || '';
    if (tText.indexOf('![[') >= 0 || /!\[[^\]]*\]\(/.test(tText)) {
      // 标题本身是图片嵌入（Obsidian 看图题）→ 渲染成图片
      tEl.innerHTML = resolveImgSrc(Core.renderMarkdown(tText));
    } else {
      tEl.textContent = tText;
    }

    var qText = (card.question || '').trim();
    var qEl = $('#rvQuestion');
    if (qText) {
      qEl.innerHTML = qText.indexOf('\n') >= 0 ? resolveImgSrc(Core.renderMarkdown(qText)) : resolveImgSrc(Core.renderInline(qText));
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
    // 撤销快照（评分前）：可恢复该卡状态与整个队列
    review.undo = {
      cardId: item.card.id,
      stat: { s: st.s, n: st.n, ok: st.ok, bad: st.bad, last: st.last, box: st.box, dueAt: st.dueAt, ivl: st.ivl },
      queue: review.queue.slice(),
      round2: review.round2.slice(),
      phase: review.phase,
      rated: review.rated,
      okCount: review.okCount, fuzzyCount: review.fuzzyCount, badCount: review.badCount,
      total: review.total
    };
    st.n = (st.n || 0) + 1;
    st.last = Date.now();
    Object.assign(st, Core.schedule(st, kind, Date.now()));
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
    review.current = null; // 先清当前：落盘的是「currentId:null + 剩余队列」，被杀也不会重显刚评过的卡
    saveReviewSession();
    scheduleSave();
    flushSave();
    nextCard();
  }

  /* ---------- 多本笔记的复习设置（数量 + 范围，无章节维度） ---------- */
  function openReviewSetupMulti(deckIds) {
    openModal(
      '<h3>' + t('review.setupTitle') + '</h3>' +
      '<div class="field"><label>' + t('review.count') + '</label>' +
        '<div class="seg-row">' +
          '<label class="seg-opt"><input type="radio" name="rvCount" value="20">' + t('review.limit20') + '</label>' +
          '<label class="seg-opt"><input type="radio" name="rvCount" value="50">' + t('review.limit50') + '</label>' +
          '<label class="seg-opt"><input type="radio" name="rvCount" value="all" checked>' + t('review.limitAll') + '</label>' +
        '</div></div>' +
      '<div class="field"><label>' + t('review.scope') + '</label>' +
        '<div class="seg-row">' +
          '<label class="seg-opt"><input type="radio" name="rvScope" value="all" checked>' + t('review.scopeAll') + '</label>' +
          '<label class="seg-opt"><input type="radio" name="rvScope" value="weak">' + t('review.weak') + '</label>' +
        '</div></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
        '<button class="btn primary" data-act="review-start-multi">' + t('review.start') + '</button>' +
      '</div>'
    );
    modalPayload = { deckIds: deckIds };
  }

  /* ---------- 撤销上一张评分 ---------- */
  function undoRate() {
    if (!review || !review.undo) { toast(t('review.noUndo')); return; }
    var u = review.undo;
    review.undo = null;
    var st = state.stats[u.cardId];
    if (st) {
      st.s = u.stat.s; st.n = u.stat.n; st.ok = u.stat.ok; st.bad = u.stat.bad;
      st.last = u.stat.last; st.box = u.stat.box; st.dueAt = u.stat.dueAt; st.ivl = u.stat.ivl;
    }
    review.queue = u.queue.slice();
    review.round2 = u.round2.slice();
    review.phase = u.phase;
    review.rated = u.rated;
    review.okCount = u.okCount; review.fuzzyCount = u.fuzzyCount; review.badCount = u.badCount;
    review.total = u.total;
    var item = resolveItem(u.cardId);
    if (!item) { // 卡片在撤销前被删：丢弃会话重新开始
      toast(t('review.noUndo'));
      clearReviewSession();
      goHome();
      return;
    }
    review.current = item;
    review.revealed = false;
    saveReviewSession();
    renderCard();
    toast(t('review.undone'), 1600);
  }

  function finishReview() {
    clearReviewSession();
    flushSave(); // 清空后立即落盘：rate() 之前写进去的「最后一个待评卡」否则会留在库里，重启后诈尸
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
            '<div class="citem-title">' + ESC(c.title) + (c.modified ? ' <span class="citem-mod">' + ESC(t('card.modified')) + '</span>' : '') + '</div>' +
            '<div class="citem-snip">' + ESC(Core.plainText(c.answer).slice(0, 80)) + '</div>' +
            '<div class="citem-ops">' +
              '<button class="btn xs" data-act="card-edit" data-deck="' + d.id + '" data-card="' + ESC(c.id) + '">' + t('card.opEdit') + '</button>' +
              '<button class="btn xs" data-act="card-split" data-deck="' + d.id + '" data-card="' + ESC(c.id) + '">' + t('card.opSplit') + '</button>' +
              '<button class="btn xs" data-act="card-merge" data-deck="' + d.id + '" data-card="' + ESC(c.id) + '">' + t('card.opMerge') + '</button>' +
              '<button class="btn xs" data-act="card-move" data-deck="' + d.id + '" data-card="' + ESC(c.id) + '">' + t('card.opMove') + '</button>' +
              '<button class="btn xs ghost" data-act="card-undo">' + t('card.opUndo') + '</button>' +
            '</div>' +
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
    // 与新版编辑器一致：重算 id、标记已修改、迁移进度（避免旧弹窗留下陈旧 id）
    var oldId = modalPayload.cardId;
    var newId = 'c' + Core.hash32(card.title + '|' + card.question + '|' + card.answer);
    if (state.stats[oldId] && !state.stats[newId]) state.stats[newId] = state.stats[oldId];
    if (newId !== oldId) delete state.stats[oldId];
    card.id = newId;
    card.modified = true;
    browse.cardId = newId;
    scheduleSave();
    closeModal();
    renderBrowse();
    toast(t('toast.saved'));
  }

  function deleteCardById(deckId, cardId, skipConfirm) {
    var d = findDeck(deckId);
    if (!d) return false;
    if (!skipConfirm && !window.confirm(t('confirm.deleteCard'))) return false;
    var delId = cardId;
    if (delId) {
      var sharedElsewhere = state.decks.some(function (x) {
        return x.id !== d.id && x.cards.some(function (cc) { return cc.id === delId; });
      });
      if (!sharedElsewhere) delete state.stats[delId];
    }
    d.cards = d.cards.filter(function (c) { return c.id !== delId; });
    if (!d.cards.length) {
      state.decks = state.decks.filter(function (x) { return x.id !== d.id; });
    }
    cleanupUnreferencedImages();
    scheduleSave();
    return true;
  }

  function deleteCard() {
    if (!modalPayload) return;
    var d = findDeck(modalPayload.deckId);
    if (!d) return;
    if (!window.confirm(t('confirm.deleteCard'))) return;
    var delId = modalPayload.cardId;
    if (delId) {
      // 同一 id 的卡若被其他笔记引用（内容哈希相同），保留其进度
      var sharedElsewhere = state.decks.some(function (x) {
        return x.id !== d.id && x.cards.some(function (cc) { return cc.id === delId; });
      });
      if (!sharedElsewhere) delete state.stats[delId];
    }
    d.cards = d.cards.filter(function (c) { return c.id !== delId; });
    if (!d.cards.length) {
      state.decks = state.decks.filter(function (x) { return x.id !== d.id; });
    }
    cleanupUnreferencedImages(); // 删卡后清理无引用图片
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
    // 完整路径分组：祖先标题链 + 所属小节，不同章节下的同名小节不会合并
    var parts = [];
    (card.path || []).forEach(function (p) {
      p = String(p || '').trim();
      if (p && parts.indexOf(p) < 0) parts.push(p);
    });
    var ch = String(card.chapter || '').trim();
    if (ch && parts.indexOf(ch) < 0) parts.push(ch);
    return parts.length ? parts.join(' / ') : t('quick.uncategorized');
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
    var decks = deckIds
      ? state.decks.filter(function (d) { return deckIds.indexOf(d.id) >= 0; })
      : state.decks;
    // 单 deck 导出只带该 deck 卡片的 stats，避免把其它笔记的进度也带过去
    var stats = state.stats;
    if (deckIds) {
      var wanted = Object.create(null);
      decks.forEach(function (d) { d.cards.forEach(function (c) { wanted[c.id] = 1; }); });
      stats = {};
      Object.keys(state.stats).forEach(function (k) { if (wanted[k]) stats[k] = state.stats[k]; });
    }
    var payload = {
      app: 'md-review',
      version: 1,
      exportedAt: new Date().toISOString(),
      decks: decks,
      stats: stats,
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

  function downloadBinary(filename, mime, u8) {
    // zip 等二进制：Android 走 saveBinary 桥（第 5 步注入），浏览器走 Blob 下载
    if (window.AndroidSaver && typeof window.AndroidSaver.saveBinary === 'function') {
      try {
        var b64 = '';
        var CH = 32768;
        for (var i = 0; i < u8.length; i += CH) {
          b64 += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
        }
        var saved = window.AndroidSaver.saveBinary(filename, mime, btoa(b64));
        if (saved) { toast(tf('toast.savedToDownloads', { name: filename }), 3000); return; }
      } catch (e) { /* fallback */ }
    }
    try {
      var blob = new Blob([u8], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
      toast(t('toast.downloading'), 2600);
    } catch (e) { toast(t('toast.downloadFail')); }
  }

  /* ---------- 备份 zip：backup.json + images/ ---------- */
  function backupPayload(deckIds) {
    var payload = JSON.parse(backupJson(deckIds));
    payload.kind = deckIds ? 'deck' : 'full';
    if (!deckIds) delete payload.version_note;
    return payload;
  }

  function buildBackupZipFiles() {
    var enc = new TextEncoder();
    var payload = backupPayload(null);
    var files = [{ name: 'backup.json', data: enc.encode(JSON.stringify(payload)) }];
    return Store.rawGet('imgIndex').then(function (list) {
      var names = list || [];
      return Promise.all(names.map(function (n) {
        return Store.rawGet('img/' + n).then(function (rec) {
          if (rec && rec.blob) {
            return rec.blob.arrayBuffer().then(function (ab) {
              files.push({ name: 'images/' + n, data: new Uint8Array(ab) });
            });
          }
          return null;
        });
      }));
    }).then(function () {
      return Core.zipStore(files);
    });
  }

  function markBackedUp() {
    state.lastBackupAt = Date.now();
    state.backupRemindDismissedAt = 0;
    flushSave();
  }

  function exportBackupZip() {
    buildBackupZipFiles().then(function (zip) {
      markBackedUp();
      downloadBinary('md-flashcards-backup-' + dateStamp() + '.zip', 'application/zip', zip);
    }).catch(function () {
      toast(t('toast.downloadFail'), 3000);
    });
  }

  /* ---------- 备份文件夹（File System Access，仅支持的浏览器） ---------- */
  function fsaSupported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  function saveBackupDirHandle(handle) {
    return Store.rawPut('backupDirHandle', handle);
  }

  function getBackupDirHandle() {
    return Store.rawGet('backupDirHandle');
  }

  function pickBackupFolder() {
    if (!fsaSupported()) { toast(t('backup.fsaUnsupported'), 3000); return; }
    window.showDirectoryPicker({ mode: 'readwrite' }).then(function (h) {
      return saveBackupDirHandle(h).then(function (ok) {
        toast(ok ? t('backup.folderSet') : t('toast.saveFail'));
        renderStorageSection();
      });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return; // 用户取消
      toast(t('backup.fsaUnsupported'), 3000);
    });
  }

  function backupNow() {
    var doDownload = function () {
      exportBackupZip();
    };
    if (!fsaSupported()) { doDownload(); return; }
    getBackupDirHandle().then(function (h) {
      if (!h) { doDownload(); return; }
      return buildBackupZipFiles().then(function (zip) {
        var name = 'md-flashcards-backup-' + dateStamp() + '-' + new Date().toTimeString().slice(0, 8).replace(/:/g, '') + '.zip';
        return h.getFileHandle(name, { create: true }).then(function (fh) {
          return fh.createWritable().then(function (w) {
            return w.write(zip).then(function () { return w.close(); });
          });
        }).then(function () {
          markBackedUp();
          renderHome();
          toast(tf('backup.savedToFolder', { name: name }), 3000);
        });
      });
    }).catch(function () { doDownload(); });
  }

  function renderStorageSection() {
    var btn = $('#backupFolderBtn');
    if (!btn) return;
    if (!fsaSupported()) return; // 不支持的浏览器不显示文件夹功能
    getBackupDirHandle().then(function (h) {
      if (btn) btn.textContent = h ? t('backup.folderChange') : t('backup.folderSet');
    });
  }

  /* ---------- 导入解析：zip 或旧 json ---------- */
  function parseBackupBuffer(buf) {
    var b = new Uint8Array(buf);
    if (b.length > 3 && b[0] === 0x50 && b[1] === 0x4b) {
      return Core.unzipFiles(buf, /\.(json|md|markdown|txt|png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i).then(function (list) {
        var dec = new TextDecoder();
        var obj = null;
        var images = [];
        list.forEach(function (en) {
          var nm = en.name || '';
          if (/^backup\.json$/i.test(nm.split('/').pop()) && !obj) {
            try { obj = JSON.parse(dec.decode(en.bytes)); } catch (e) { obj = null; }
          } else if (nm.indexOf('images/') === 0) {
            images.push({ name: nm.slice('images/'.length), bytes: en.bytes });
          }
        });
        if (!obj) throw new Error('no backup.json');
        return { obj: obj, images: images };
      });
    }
    // 旧 json
    return Promise.resolve(decodeTextBytes(buf)).then(function (text) {
      var obj = null;
      try { obj = JSON.parse(text); } catch (e) { obj = null; }
      if (!obj) throw new Error('bad json');
      return { obj: obj, images: [] };
    });
  }

  /* ---------- 合并：deck 按 id 匹配，冲突建副本加后缀；stats 只补缺 ---------- */
  function mergeBackupState(localRaw, backupObj) {
    var next = JSON.parse(JSON.stringify(localRaw)); // 在副本上构造，任何一步失败本地不动
    var decks = next.decks || [];
    (backupObj.decks || []).forEach(function (bd) {
      if (!bd || !Array.isArray(bd.cards)) return;
      var hit = decks.filter(function (d) { return d.id === bd.id; })[0];
      if (hit) {
        var copy = JSON.parse(JSON.stringify(bd));
        copy.id = uid('d');
        copy.name = String(bd.name || '').slice(0, 60) + t('import.suffix');
        copy.createdAt = Date.now();
        decks.push(copy);
      } else {
        decks.push(JSON.parse(JSON.stringify(bd)));
      }
    });
    next.decks = decks;
    var stats = next.stats || {};
    Object.keys(backupObj.stats || {}).forEach(function (cid) {
      if (!stats[cid]) stats[cid] = backupObj.stats[cid]; // 只补缺失，不覆盖本地进度
    });
    next.stats = stats;
    return next;
  }

  /* ---------- 导入预览 → 覆盖 / 合并 ---------- */
  function importBackupBuffer(buf) {
    parseBackupBuffer(buf).then(function (r) {
      var obj = r.obj;
      if (!obj || !Array.isArray(obj.decks)) throw new Error('bad');
      var cards = 0;
      obj.decks.forEach(function (d) { cards += (d.cards || []).length; });
      var when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString() : '-';
      var ver = obj.version || '-';
      openModal(
        '<h3>' + t('import.backupTitle') + '</h3>' +
        '<p class="modal-note">' +
          tf('import.backupMeta', { decks: obj.decks.length, cards: cards, images: r.images.length }) + '<br>' +
          tf('import.backupWhen', { time: when, v: ver }) +
        '</p>' +
        '<div class="modal-actions">' +
          '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
          '<button class="btn primary" data-act="backup-merge">' + t('import.merge') + '</button>' +
          (obj.kind === 'deck' ? '' : '<button class="btn" data-act="backup-overwrite">' + t('import.overwrite') + '</button>') +
        '</div>'
      );
      modalPayload = { backupObj: obj, backupImages: r.images };
    }).catch(function () {
      toast(t('toast.badBackup'), 3000);
    });
  }

  function storeBackupImages(images) {
    // 图片写入是纯增量（名字→blob），失败不影响笔记数据；返回 同名冲突改名映射
    // 串行：备份里也可能有同名不同内容的图片，并行会互相覆盖（见 importImageEntries）
    var renames = {};
    return (images || []).reduce(function (p, im) {
      return p.then(function () {
        return storeImage(im.name, new Blob([im.bytes], { type: imgMime(im.name) }), renames);
      });
    }, Promise.resolve()).then(function () { return renames; });
  }

  /** 备份导入时：同名冲突被改名的图片 → 重写备份里卡片引用（纯函数，供测试） */
  function applyBackupRenames(obj, renames) {
    if (!obj || !renames) return obj;
    var keys = Object.keys(renames);
    if (!keys.length) return obj;
    (obj.decks || []).forEach(function (d) {
      (d.cards || []).forEach(function (c) {
        keys.forEach(function (oldN) {
          [c.title, c.question, c.answer].forEach(function (f, fi) {
            if (typeof f === 'string' && f.indexOf(oldN) >= 0) {
              var nv = f.split(oldN).join(renames[oldN]);
              if (fi === 0) c.title = nv; else if (fi === 1) c.question = nv; else c.answer = nv;
            }
          });
          if (typeof d.raw === 'string' && d.raw.indexOf(oldN) >= 0) {
            d.raw = d.raw.split(oldN).join(renames[oldN]);
          }
        });
      });
    });
    return obj;
  }

  function applyBackupOverwrite() {
    lastOpSnapshot = null; // 覆盖后卡片全换，撤销快照失效
    var obj = modalPayload && modalPayload.backupObj;
    var images = (modalPayload && modalPayload.backupImages) || [];
    if (!obj) return;
    if (obj.kind === 'deck') return; // 单笔记备份不提供覆盖
    if (!window.confirm(t('confirm.overwriteBackup'))) return;
    // 回滚安全：图片先写（增量，冲突改名写回引用），状态整体替换是单次赋值
    storeBackupImages(images).then(function (renames) {
      applyBackupRenames(obj, renames);
      var prevSettings = state.settings;
      var prevSession = null;
      state = normalizeState(obj);
      state.settings.ai = prevSettings.ai;
      state.settings.theme = prevSettings.theme;
      state.settings.lang = prevSettings.lang;
      state.reviewSession = prevSession;
      pruneDaily();
      applyTheme();
      applyReading();
      applyI18nStatic();
      flushSave();
      closeModal();
      renderHome();
      toast(tf('toast.backupImported', { n: state.decks.length }), 2600);
    });
  }

  function applyBackupMerge() {
    lastOpSnapshot = null; // 合并后卡片集合变化，撤销快照失效
    var obj = modalPayload && modalPayload.backupObj;
    var images = (modalPayload && modalPayload.backupImages) || [];
    if (!obj) return;
    storeBackupImages(images).then(function (renames) {
      applyBackupRenames(obj, renames);
      var nextRaw = mergeBackupState(state, obj); // 在副本上合并
      var prevSettings = state.settings;
      state = normalizeState(nextRaw); // 任何解析异常在赋值前抛出，本地数据不动
      state.settings.ai = prevSettings.ai;
      pruneDaily();
      flushSave();
      closeModal();
      renderHome();
      toast(tf('toast.backupMerged', { n: obj.decks.length }), 2600);
    }).catch(function () {
      toast(t('toast.badBackup'), 3000);
    });
  }

  function importBackup(text) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (!obj || !Array.isArray(obj.decks)) {
      toast(t('toast.badBackup'));
      return;
    }
    if (!window.confirm(t('confirm.importBackup'))) return;
    lastOpSnapshot = null; // 旧 json 恢复：撤销快照失效
    // 恢复只覆盖「笔记 + 进度 + 统计」；AI 供应商配置（备份里本来就没有 Key）、主题、语言保留本机当前的
    var prevSettings = state.settings;
    state = normalizeState(obj);
    state.settings.ai = prevSettings.ai;
    state.settings.theme = prevSettings.theme;
    state.settings.lang = prevSettings.lang;
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
      case 'tab': {
        var tabView = el.getAttribute('data-view');
        if (tabView === 'home') goHome();
        else if (tabView === 'manage') openManage();
        else if (tabView === 'settings') openSettings();
        else if (tabView === 'stats') { renderStats(); showView('stats'); }
        break;
      }
      case 'stats-today':
        setStatsNavToToday();
        renderStatsCharts();
        break;
      case 'check-update':
        checkUpdate();
        break;
      case 'update-go':
        closeModal();
        var w = null;
        try { w = window.open(RELEASES_URL, '_blank'); } catch (e) { /* 忽略 */ }
        if (!w) { try { location.href = RELEASES_URL; } catch (e2) { /* WebView 走 shouldOverrideUrlLoading 转系统浏览器 */ } }
        break;
      case 'stats-view':
        state.settings.statsView = el.getAttribute('data-mode') === 'bars' ? 'bars' : 'heat';
        applyStatsMode();
        scheduleSave();
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
        openReviewSetup(el.getAttribute('data-deck'));
        break;
      }
      case 'review-start': {
        var sd = el.getAttribute('data-deck');
        var cnt = (document.querySelector('input[name="rvCount"]:checked') || {}).value || 'all';
        var scope = (document.querySelector('input[name="rvScope"]:checked') || {}).value || 'all';
        var chap = (document.querySelector('#rvChapterSel') || {}).value || '';
        closeModal();
        startReview([sd], {
          count: cnt === 'all' ? 0 : parseInt(cnt, 10),
          scope: scope,
          chapter: chap,
          filter: state.settings.filter
        });
        break;
      }
      case 'review-start-multi': {
        var mids = (modalPayload && modalPayload.deckIds) || [];
        var mcnt = (document.querySelector('input[name="rvCount"]:checked') || {}).value || 'all';
        var mscope = (document.querySelector('input[name="rvScope"]:checked') || {}).value || 'all';
        closeModal();
        if (mids.length) startReview(mids, {
          count: mcnt === 'all' ? 0 : parseInt(mcnt, 10),
          scope: mscope,
          filter: state.settings.filter
        });
        break;
      }
      case 'resume-review':
        resumeReview();
        break;
      case 'undo-rate':
        undoRate();
        break;
      case 'review-all': {
        var ids = state.decks.map(function (d) { return d.id; });
        if (ids.length) openReviewSetupMulti(ids);
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
      case 'ai-undo': {
        var lr = aiRun && aiRun.lastRefine;
        var ud = findDeck((el && el.getAttribute('data-deck')) || (lr && lr.deckId));
        if (ud && lr && lr.snapshot && lr.deckId === ud.id && lr.snapshot.length === ud.cards.length && !lr.undone) {
          ud.cards.forEach(function (uc, ui) { uc.question = lr.snapshot[ui]; });
          lr.undone = true;
          scheduleSave();
          renderHome();
          toast(t('ai.undone'));
        } else {
          toast(t('ai.undoFail'), 4000);
        }
        break;
      }
      case 'delete-card':
        deleteCard();
        break;
      case 'delete-deck': {
        var id = el.getAttribute('data-deck');
        var d = findDeck(id);
        if (!d) break;
        if (!window.confirm(tf('confirm.deleteDeck', { name: d.name, n: d.cards.length }))) break;
        // 只清「本笔记独有」卡片的进度：同 id 卡片被其他笔记引用时保留（内容相同 → 同 id 哈希）
        var others = {};
        state.decks.forEach(function (x) {
          if (x.id === id) return;
          x.cards.forEach(function (c) { others[c.id] = 1; });
        });
        d.cards.forEach(function (c) { if (!others[c.id]) delete state.stats[c.id]; });
        state.decks = state.decks.filter(function (x) { return x.id !== id; });
        cleanupUnreferencedImages(); // 异步清理无引用图片
        scheduleSave();
        if ($('#view-manage').classList.contains('active')) { renderManage(); } else { renderHome(); }
        toast(t('toast.deleted'));
        break;
      }
      case 'export-deck': {
        var did = el.getAttribute('data-deck');
        var dd = findDeck(did);
        if (!dd) break;
        var dj = backupPayload([did]);
        showExport(JSON.stringify(dj), 'md-review-' + safeName(dd.name) + '-' + dateStamp() + '.json');
        break;
      }
      case 'export-all':
        if (!state.decks.length) { toast(t('toast.noNotes')); break; }
        exportBackupZip();
        break;
      case 'wiki-jump': {
        closeModal();
        openBrowse(el.getAttribute('data-deck'));
        browse.q = '';
        var jumpId = el.getAttribute('data-card');
        setTimeout(function () {
          var el2 = document.querySelector('.citem[data-card="' + jumpId + '"]');
          if (el2) { el2.scrollIntoView({ block: 'center' }); el2.style.outline = '2px solid #3b82f6'; setTimeout(function () { el2.style.outline = ''; }, 2000); }
        }, 120);
        break;
      }
      case 'gs-open': {
        openGsCard(parseInt(el.getAttribute('data-i'), 10) || 0);
        break;
      }
      case 'gs-review': {
        var gdeck = el.getAttribute('data-deck');
        var gcard = el.getAttribute('data-card');
        closeModal();
        startReview([gdeck], { startCard: gcard, resumeOk: false });
        break;
      }
      case 'gs-browse': {
        var bdeck = el.getAttribute('data-deck');
        closeModal();
        openBrowse(bdeck);
        break;
      }
      case 'card-edit':
        openCardEdit(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-edit-save':
        saveCardEdit(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-split':
        openCardSplit(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-split-do':
        doCardSplit(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-merge':
        doCardMerge(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-move':
        openCardMove(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-move-do':
        doCardMove(el.getAttribute('data-deck'), el.getAttribute('data-card'));
        break;
      case 'card-undo':
        undoLastCardOp();
        break;
      case 'tag-filter': {
        var tg = el.getAttribute('data-tag');
        state.settings.tagFilter = (state.settings.tagFilter === tg) ? '' : tg;
        flushSave();
        renderHome();
        break;
      }
      case 'deck-sort': {
        state.settings.deckSort = el.value;
        flushSave();
        renderHome();
        break;
      }
      case 'pin-set': {
        if (!FEATURE_APP_LOCK) break; // 功能隐藏时忽略
        var pv = (($('#pinInput') || {}).value || '').trim();
        if (!/^\d{4}$/.test(pv)) { toast(t('pin.badFormat')); break; }
        if (window.AndroidSaver && AndroidSaver.pinSet) {
          var okp = AndroidSaver.pinSet(pv);
          toast(okp ? t('pin.setOk') : t('toast.saveFail'));
        } else {
          toast(t('pin.androidOnly'));
        }
        break;
      }
      case 'pin-remove':
        if (!FEATURE_APP_LOCK) break; // 功能隐藏时忽略
        if (window.AndroidSaver && AndroidSaver.pinRemove) { AndroidSaver.pinRemove(); toast(t('pin.removed')); }
        else toast(t('pin.androidOnly'));
        break;
      case 'rem-set': {
        var rv = (($('#remTime') || {}).value || '20:00').split(':');
        if (window.AndroidSaver && AndroidSaver.reminderSet) {
          AndroidSaver.reminderSet(parseInt(rv[0], 10), parseInt(rv[1], 10));
          toast(t('rem.setOk'));
        } else toast(t('rem.androidOnly'));
        break;
      }
      case 'rem-cancel':
        if (window.AndroidSaver && AndroidSaver.reminderCancel) { AndroidSaver.reminderCancel(); toast(t('rem.cancelled')); }
        else toast(t('rem.androidOnly'));
        break;
      case 'backup-folder':
        pickBackupFolder();
        break;
      case 'backup-now':
        backupNow();
        break;
      case 'backup-remind-dismiss':
        state.backupRemindDismissedAt = Date.now();
        flushSave();
        renderHome();
        break;
      case 'img-repair':
        toast(t('img.repairRunning'), 2600);
        loadStoredImages().then(function (rep) {
          if (!rep || rep.unavailable) { toast(t('img.repairFail')); return; }
          var extra = rep.retyped ? tf('img.repairRetyped', { n: rep.retyped }) : '';
          if (!rep.added && !rep.dropped && !rep.retyped) { toast(tf('img.repairOk', { n: rep.total })); return; }
          toast(tf('img.repairDone', { added: rep.added, dropped: rep.dropped, total: rep.total }) + extra, 4200);
          // 重绘当前页面：修复前画出的「未导入」占位要换回图片
          if ($('#view-manage').classList.contains('active')) renderManage(); else renderHome();
        }).catch(function () { toast(t('img.repairFail')); });
        break;
      case 'img-cleanup':
        unreferencedImages().then(function (unused) {
          if (!unused.length) { toast(t('img.cleanupNone')); return; }
          var kb = unused.reduce(function (a, u) { return a + u.size; }, 0) / 1024;
          if (!window.confirm(tf('img.cleanupConfirm', { n: unused.length, kb: kb.toFixed(0) }))) return;
          cleanupUnreferencedImages().then(function (n) {
            toast(tf('img.cleanupDone', { n: n }));
          });
        });
        break;
      case 'backup-overwrite':
        applyBackupOverwrite();
        break;
      case 'backup-merge':
        applyBackupMerge();
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
        if (review) startReview(review.deckIds, {});
        break;
      case 'again-todo':
        if (review) startReview(review.deckIds, { filter: 'todo' });
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

  function applyFeatureFlags() {
    var lockField = $('#fieldAppLock');
    if (lockField) lockField.classList.toggle('hidden', !FEATURE_APP_LOCK);
  }

  function openSettings() {
    showView('settings');
    applyFeatureFlags();
    var fbtn = $('#backupFolderBtn');
    if (fbtn && fsaSupported()) fbtn.classList.remove('hidden');
    renderStorageSection();
    var rd = state.settings.reading || { fs: 'm', lh: 2, cw: 2 };
    if ($('#setReadFs')) $('#setReadFs').value = rd.fs || 'm';
    if ($('#setReadLh')) $('#setReadLh').value = String(rd.lh || 2);
    if ($('#setReadCw')) $('#setReadCw').value = String(rd.cw || 2);
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
    // 图片解码失败（格式浏览器不支持 / 存储里丢了类型信息）→ 显示明确占位。
    // 否则 Chromium 会把 alt 文字撑进图片框，看起来像「图片内容变成了文件名」。
    document.addEventListener('error', function (e) {
      var el = e.target;
      if (!el || !el.tagName || el.tagName !== 'IMG') return;
      if (el.closest && el.closest('#imgViewer')) return;
      if (el.dataset && el.dataset.broken) return;
      var name = (el.dataset && el.dataset.img) || el.getAttribute('alt') || '';
      // 旧 URL 被回收后重新导入会换新 URL：先重试一次，别急着判定「无法显示」
      var cur = (el.dataset && el.dataset.img && IMG_URLS[el.dataset.img]) || '';
      if (cur && cur !== el.getAttribute('src')) {
        el.dataset.broken = 'retry';
        el.addEventListener('load', function () { delete el.dataset.broken; }, { once: true });
        el.src = cur;
        return;
      }
      var chip = document.createElement('span');
      chip.className = 'img-missing';
      chip.textContent = '🖼 ' + t('img.broken') + (name ? '：' + name : '');
      if (el.parentNode) el.parentNode.replaceChild(chip, el);
    }, true);
    document.addEventListener('pointerover', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-tip]');
      if (t && e.pointerType === 'mouse') showStatTip(t);
    });
    document.addEventListener('pointerout', function (e) {
      if (e.pointerType === 'mouse' && e.target && e.target.closest && e.target.closest('[data-tip]')) hideStatTip();
    });
    document.addEventListener('pointerdown', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-tip]');
      if (t) showStatTip(t);
    });
    document.addEventListener('click', function (e) {
      var ivImg = e.target.closest ? e.target.closest('#imgViewer img') : null;
      if (ivImg) return; // 大图自身的双击由 touchend 处理
      var mdImg = e.target.closest ? e.target.closest('.md-img, .rv-title img, .rv-q img, .rv-answer img, .quick-a img') : null;
      if (mdImg && mdImg.getAttribute('src')) { openImageViewer(mdImg.getAttribute('src')); return; }
      var copyBtn = e.target.closest ? e.target.closest('[data-act="code-copy"]') : null;
      if (copyBtn) {
        // 按钮在 .md-code-bar 内，与 <pre> 是兄弟节点：必须从外层 wrap 找
        var wrap = copyBtn.closest('.md-code-wrap');
        var pre = wrap ? wrap.querySelector('pre') : null;
        var code = '';
        if (pre) {
          // dataset.raw 已被浏览器解码为原始字符，不能再解一次（否则 &amp; 会被解成 &）
          if (pre.dataset && pre.dataset.raw != null) {
            code = pre.dataset.raw;
          } else {
            code = (pre.querySelector('code') || {}).textContent || '';
          }
        }
        if (!code.trim() && wrap) {
          var codeEl = wrap.querySelector('code');
          code = codeEl ? codeEl.textContent || '' : '';
        }
        copyText(code);
        return;
      }
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
      readFileBuffer(f).then(function (buf) { importBackupBuffer(buf); }).catch(function () { toast(t('toast.readFailGeneric')); });
      e.target.value = '';
    });

    var gs = $('#globalSearch');
    if (gs) {
      gs.addEventListener('input', function () {
        if (searchAllTimer) clearTimeout(searchAllTimer);
        searchAllTimer = setTimeout(runGlobalSearch, 150); // 防抖
      });
    }
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
      } else if (e.target.id === 'deckSort') {
        state.settings.deckSort = e.target.value;
        flushSave();
        renderHome();
      } else if (e.target.id === 'setReadFs') {
        onReadingChange('fs', e.target.value);
      } else if (e.target.id === 'setReadLh') {
        onReadingChange('lh', parseInt(e.target.value, 10));
      } else if (e.target.id === 'setReadCw') {
        onReadingChange('cw', parseInt(e.target.value, 10));
      } else if (e.target.id === 'statsY' || e.target.id === 'statsM' || e.target.id === 'statsD') {
        onStatsNavChange(e.target.id);
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
    flushCount: function () { return flushCount; },
    flushSave: flushSave,
    readRawState: function () { return Store.rawGet('state'); },
    highlightCode: (typeof highlightCode === 'function') ? highlightCode : null,
    parseBackupBuffer: parseBackupBuffer,
    referencedImageNames: referencedImageNames,
    unreferencedImages: unreferencedImages,
    applyBackupRenames: applyBackupRenames,
    cardOps: { edit: saveCardEdit, split: doCardSplit, merge: doCardMerge, undo: undoLastCardOp },
    importBackupBuffer: importBackupBuffer,
    _normalize: normalizeState,
    renderAnswerHtml: renderAnswerHtml,
    cleanupUnreferencedImages: cleanupUnreferencedImages,
    cleanupPlan: cleanupPlan,
    deleteCardById: deleteCardById,
    storeImageForTest: function (name, bytes, type) {
      return storeImage(name, new Blob([new Uint8Array(bytes)], { type: type || imgMime(name) }));
    },
    normalizeImageBlob: normalizeImageBlob,
    imgMime: imgMime,
    openImageViewer: openImageViewer,
    closeImageViewer: closeImageViewer,
    imgViewerTransform: function () {
      var i = document.querySelector('#imgViewer img');
      return i ? (i.style.transform || '') : '';
    },
    rewriteZipImageRefs: rewriteZipImageRefs,
    zipJoin: zipJoin,
    importImageEntriesForTest: function (entries) {
      var map = {};
      return importImageEntries(entries.map(function (en) {
        return { name: en.name, bytes: new Uint8Array(en.bytes) };
      }), map).then(function (n) { return { stored: n, pathMap: map }; });
    },
    repairImageIndex: repairImageIndex,
    loadStoredImages: loadStoredImages,
    imgIndexNames: function () {
      return Store.rawGet('imgIndex').then(function (list) { return list || []; });
    },
    setImgIndexForTest: function (list) { return Store.rawPut('imgIndex', list || []); },
    setImgForTest: function (name, bytes, type) {
      return Store.rawPut('img/' + name, { blob: new Blob([new Uint8Array(bytes)], { type: type == null ? imgMime(name) : type }), name: name, added: Date.now() });
    },
    imgBlobTypeForTest: function (name) {
      return Store.rawGet('img/' + name).then(function (rec) { return rec && rec.blob ? rec.blob.type : null; });
    },
    imgRawUrlForTest: function (name) {
      return Store.rawGet('img/' + name).then(function (rec) {
        return rec && rec.blob ? URL.createObjectURL(rec.blob) : null;
      });
    },
    imgUrlCount: function () { return Object.keys(IMG_URLS).length; },
    rawDeleteForTest: function (key) { return Store.rawDelete(key); },
    idsPresentInIndex: function (list) {
      return Store.rawGet('imgIndex').then(function (cur) {
        var have = cur || [];
        var out = {};
        list.forEach(function (n) { out[n] = have.indexOf(n) >= 0; });
        return out;
      });
    },
    idbHasKey: function (key) {
      return Store.rawGet(key).then(function (v) { return v != null; });
    },
    clearOpSnapshot: function () { lastOpSnapshot = null; },
    store: {
      close: function () { return Store.close(); },
      reopen: function () { return Store.reopen(); },
      isWiping: function () { return Store.isWiping(); },
      isLocked: function () { return Store.isLocked(); }
    },
    wipeOrder: function () { return window.__wipeOrder || null; },
    wipeAllData: function (dryRun) { return window.__wipeAllData(dryRun); },
    hasOpSnapshot: function () { return !!lastOpSnapshot; },
    mergeBackupState: mergeBackupState,
    buildBackupFiles: function () { return backupPayload(null); },
    renderStats: renderStats,
    rememberImage: rememberImage,
    resolveImgSrc: resolveImgSrc,
    version: APP_VERSION
  };

  // 代码高亮钩子（core 渲染时调用）
  window.__mdfcHighlight = highlightCode;

  /* ---------- 图片放大（双击缩放、单指拖动、双指捏合、左右滑动关闭、点遮罩关闭） ---------- */
  var imgViewerClosing = false;
  var imgViewerTimer = 0;
  function openImageViewer(src) {
    var old = $('#imgViewer');
    if (!old || !old.parentNode) return;
    // 换一个干净的同名节点：每次打开都重新绑手势会叠加，第 N 次打开就有 N 套监听器互相打架
    var v = old.cloneNode(false);
    old.parentNode.replaceChild(v, old);
    // 滑出动画还没结束又点开新图：取消上一次的收尾，否则新图会被一起隐藏
    if (imgViewerTimer) { clearTimeout(imgViewerTimer); imgViewerTimer = 0; }
    imgViewerClosing = false;
    v.innerHTML = '<img src="' + ESC(src) + '" alt="">';
    v.classList.remove('hidden');
    var img = v.querySelector('img');
    var scale = 1, tx = 0, ty = 0;
    var startX = 0, startY = 0, lastX = 0, lastY = 0, startT = 0;
    var pinchDist = 0, pinchMx = 0, pinchMy = 0;
    var moved = false, pinching = false, mouseDown = false;
    var lastTap = 0;

    var apply = function (anim) {
      img.classList.toggle('noanim', !anim);
      img.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
    };
    // 缩放后把图限制在可视范围内：留一点余量，拖到边缘就停住（不会把图拖丢）
    var clampT = function () {
      var r = img.getBoundingClientRect();
      var maxX = Math.max(0, (r.width - v.clientWidth) / 2);
      var maxY = Math.max(0, (r.height - v.clientHeight) / 2);
      if (tx > maxX) tx = maxX;
      if (tx < -maxX) tx = -maxX;
      if (ty > maxY) ty = maxY;
      if (ty < -maxY) ty = -maxY;
    };
    // 以屏幕上某点为中心缩放（双击 / 捏合都用它），点下面的内容保持不动
    var zoomAt = function (ns, px, py, anim) {
      ns = Math.min(6, Math.max(1, ns));
      var k = ns / scale;
      var cx = px - v.clientWidth / 2;
      var cy = py - v.clientHeight / 2;
      tx = cx - (cx - tx) * k;
      ty = cy - (cy - ty) * k;
      scale = ns;
      if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
      clampT();
      apply(anim);
    };

    v.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinching = true;
        moved = true;
        var a = e.touches[0], b = e.touches[1];
        pinchDist = Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2));
        pinchMx = (a.clientX + b.clientX) / 2;
        pinchMy = (a.clientY + b.clientY) / 2;
        return;
      }
      if (e.touches.length === 1) {
        var t0 = e.touches[0];
        startX = lastX = t0.clientX;
        startY = lastY = t0.clientY;
        startT = Date.now();
        moved = false;
        pinching = false;
      }
    }, { passive: true });

    v.addEventListener('touchmove', function (e) {
      if (e.touches.length >= 2) {
        e.preventDefault();
        var a = e.touches[0], b = e.touches[1];
        var dist = Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2));
        var mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
        if (pinchDist > 0) {
          var ns = Math.min(6, Math.max(1, scale * dist / pinchDist));
          var k = ns / scale;
          var cx = mx - v.clientWidth / 2, cy = my - v.clientHeight / 2;
          tx = cx - (cx - tx) * k + (mx - pinchMx);
          ty = cy - (cy - ty) * k + (my - pinchMy);
          scale = ns;
          if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
          clampT();
          apply(false);
        }
        pinchDist = dist; pinchMx = mx; pinchMy = my;
        return;
      }
      if (e.touches.length === 1) {
        var t0 = e.touches[0];
        var dx = t0.clientX - lastX, dy = t0.clientY - lastY;
        lastX = t0.clientX; lastY = t0.clientY;
        if (Math.abs(t0.clientX - startX) > 8 || Math.abs(t0.clientY - startY) > 8) moved = true;
        if (scale > 1.001) {
          e.preventDefault();
          tx += dx; ty += dy;
          clampT();
          apply(false);
        } else if (moved && Math.abs(t0.clientX - startX) > 12) {
          e.preventDefault(); // 横向滑动关闭，别让页面在背后滚动
        }
      }
    }, { passive: false });

    var endTouch = function (e) {
      if (e.touches && e.touches.length > 0) {
        // 双指抬起一根：剩下那根继续拖，位置要从当前手指重新算，否则会跳一下
        pinchDist = 0;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        return;
      }
      pinchDist = 0;
      if (pinching) { pinching = false; return; }
      var dx = lastX - startX, dy = lastY - startY;
      var dt = Date.now() - startT;
      // 未放大时：左/右滑出去就关掉（跟系统返回手势一致）
      if (scale <= 1.001 && dt < 700 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        closeImageViewer(dx > 0 ? 1 : -1);
        return;
      }
      // 轻点（没拖动）→ 双击判定
      if (!moved) {
        var now = Date.now();
        if (now - lastTap < 300) {
          lastTap = 0;
          if (scale > 1.05) { scale = 1; tx = 0; ty = 0; apply(true); }
          else zoomAt(2.5, lastX, lastY, true);
        } else {
          lastTap = now;
        }
      }
    };
    v.addEventListener('touchend', endTouch);
    v.addEventListener('touchcancel', function () { pinchDist = 0; pinching = false; });

    // 桌面端：拖动平移 + 滚轮缩放（手机用不到，测试和电脑浏览器用得上）
    img.addEventListener('mousedown', function (e) {
      if (scale <= 1.001) return;
      e.preventDefault();
      mouseDown = true;
      lastX = e.clientX; lastY = e.clientY;
    });
    v.addEventListener('mousemove', function (e) {
      if (!mouseDown) return;
      tx += e.clientX - lastX; ty += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      clampT();
      apply(false);
    });
    v.addEventListener('mouseup', function () { mouseDown = false; });
    v.addEventListener('mouseleave', function () { mouseDown = false; });
    v.addEventListener('wheel', function (e) {
      e.preventDefault();
      var step = e.deltaY > 0 ? -0.25 : 0.25;
      zoomAt(scale + step * scale, e.clientX, e.clientY, false);
    }, { passive: false });

    v.addEventListener('click', function (e) { if (e.target === v) closeImageViewer(); });
  }

  /** dir: 1 向右滑出、-1 向左滑出、0/undefined 直接关闭 */
  function closeImageViewer(dir) {
    var v = $('#imgViewer');
    if (!v || v.classList.contains('hidden') || imgViewerClosing) return;
    var img = v.querySelector('img');
    if (img && dir) {
      imgViewerClosing = true;
      img.classList.remove('noanim');
      img.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
      img.style.opacity = '0';
      img.style.transform = 'translate3d(' + (dir * 45) + 'vw,' + 0 + 'px,0) scale(.9)';
      imgViewerTimer = setTimeout(function () {
        v.classList.add('hidden');
        v.innerHTML = '';
        imgViewerClosing = false;
        imgViewerTimer = 0;
      }, 180);
      return;
    }
    v.classList.add('hidden');
    v.innerHTML = '';
  }

  /**
   * 彻底清空本机数据（供 Android「忘记 PIN → 清除数据」调用）。
   * 顺序：先关连接（否则 deleteDatabase 一直 blocked）→ 清 localStorage → 删库。
   * 只有 deleteDatabase onsuccess 才算完成；blocked/超时都不能当成成功，并恢复连接可用。
   */
  window.__wipeAllData = function (dryRun) {
    window.__wipeOrder = [];
    var mark = function (s) { try { window.__wipeOrder.push(s); } catch (e) { /* ignore */ } };
    try {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } // 0) 取消待执行的保存（否则会把 state 写回 localStorage）
      mark('cancelSave');
      Store.lockWrites();          // 0.5) 之后所有写入丢弃
      Store.close();               // 1) 先关闭并清空连接缓存
      mark('close');
      try { window.localStorage.clear(); } catch (e) { /* ignore */ }
      mark('localStorage');
      if (dryRun) { window.__wipeDone = 'ok'; mark('deleteRequested'); return true; } // 仅用于断言调用顺序
      var finished = false;
      var fail = function (why) {
        if (finished) return;
        finished = true;
        Store.reopen();            // 清除失败：解锁并允许重新打开，应用继续可用
        window.__wipeDone = why;   // 'blocked' / 'err' / 'timeout'
        mark('fail:' + why);
      };
      var rq = indexedDB.deleteDatabase('md-review');
      rq.onsuccess = function () {
        if (finished) return;
        finished = true;
        window.__wipeDone = 'ok';
        mark('deleted');
        try { window.__wipeOrder = window.__wipeOrder; } catch (e) { /* ignore */ }
        // 成功后保持 wiping（不允许再写入旧库），页面会被原生重建
      };
      rq.onerror = function () { fail('err'); };
      rq.onblocked = function () { fail('blocked'); }; // 不视为完成
      mark('deleteRequested');
      setTimeout(function () { fail('timeout'); }, 5000);
    } catch (e) {
      window.__wipeDone = 'err';
      try { Store.reopen(); } catch (e2) { /* ignore */ }
    }
    return true;
  };

  /* Android 外部分享/打开（.md/.zip）→ 走导入预览 */
  window.__externalImport = function (name, b64) {
    try {
      var bin = atob(b64);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      var buf = u8.buffer;
      var b = new Uint8Array(buf);
      if (b.length > 3 && b[0] === 0x50 && b[1] === 0x4b) {
        // zip：可能是备份 zip → 走备份导入预览；否则走笔记 zip 导入
        parseBackupBuffer(buf).then(function (r) {
          openModal(
            '<h3>' + t('import.backupTitle') + '</h3>' +
            '<p class="modal-note">' + tf('import.backupMeta', { decks: r.obj.decks.length, cards: r.obj.decks.reduce(function (a, d) { return a + (d.cards || []).length; }, 0), images: r.images.length }) + '</p>' +
            '<div class="modal-actions">' +
              '<button class="btn" data-act="close-modal">' + t('btn.cancel') + '</button>' +
              '<button class="btn primary" data-act="backup-merge">' + t('import.merge') + '</button>' +
              '<button class="btn" data-act="backup-overwrite">' + t('import.overwrite') + '</button>' +
            '</div>'
          );
          modalPayload = { backupObj: r.obj, backupImages: r.images };
        }).catch(function () {
          addQueueFiles([new File([u8], name || 'import.zip', { type: 'application/zip' })]);
          openImportModal();
        });
      } else {
        decodeTextBytes(buf).then(function (text) {
          importText(String(name || '分享笔记').replace(/\.[^.]+$/, ''), text, {});
        });
      }
    } catch (e) { toast(t('toast.readFailGeneric')); }
  };

  function boot() {
    applyFeatureFlags();
    applyReading();
    // 图库 URL 先就绪再画第一屏：否则索引/类型修复完成前，卡面会先画成「未导入」占位
    var imgsReady = loadStoredImages();
    Store.load().then(function (raw) {
      var saved = null;
      if (raw) {
        try { saved = JSON.parse(raw); } catch (e) { saved = null; }
      }
      state = normalizeState(saved);
      pruneDaily();
      applyTheme();
      applyI18nStatic();
      return imgsReady.catch(function () { return null; });
    }).then(function () {
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
