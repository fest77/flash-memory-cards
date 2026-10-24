# Android APK

最小 WebView 壳，把 `dist/md-flashcards.html` 打包成可安装的 Android App。

## 结构

```
android/
├── settings.gradle.kts
├── build.gradle.kts            # AGP 8.5.2
├── gradle.properties
└── app/
    ├── build.gradle.kts        # compileSdk 34 / minSdk 24；copyWebAssets 任务
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/mdflashcards/app/MainActivity.java
        └── res/
            ├── values/{strings,themes}.xml
            └── mipmap-*/ic_launcher.png
```

`copyWebAssets` 会把 `../dist/md-flashcards.html`（约 7 MB，内置 3 本题库和 199 张配图）复制成 `app/src/main/assets/index.html`，所以**先构建网页**：

```bash
python scripts/build.py
```

## 构建

需要 **JDK 17** + **Android SDK**（platform 34、build-tools 34）。任选其一：

### GitHub Actions（推荐，无需本地 SDK）

仓库自带 `.github/workflows/build-apk.yml`：push 到 `main` 或手动 Run workflow 后，在 Actions 页下载 `md-flashcards-debug-apk`。runner 自带 Android SDK，工作流会 `sdkmanager` 安装 34 平台并执行 `gradle assembleDebug`。

### Android Studio

`File → Open` 选择 `android/` 目录 → 等待 Gradle sync → `Build → Build APK(s)`。
产物：`android/app/build/outputs/apk/debug/app-debug.apk`。

### 命令行

```bash
cd android
gradle assembleDebug        # 需要系统 gradle 8.7+
```

> 没有 Gradle wrapper。Android Studio 提示缺 wrapper 时，用本地 Gradle 8.7+，或在
> `Settings → Build, Execution, Deployment → Build Tools → Gradle` 里选 “Use Gradle from: Specified location”。
> CI 工作流直接使用 runner 上的 `gradle` 命令，不依赖 wrapper。

## 安装

- debug 包用默认 debug 签名，手机需允许「安装未知来源应用」；
- 发布到应用商店需要自己的签名：

```bash
keytool -genkeypair -keystore release.jks -alias mdflashcards \
        -keyalg RSA -keysize 2048 -validity 10000
```

然后在 `app/build.gradle.kts` 里配置 `signingConfigs`，执行 `gradle assembleRelease`。

## 实现要点

| 点 | 说明 |
|---|---|
| 虚拟 https origin | 网页通过 `https://appassets.androidplatform.net/index.html` 提供，`WebViewClient.shouldInterceptRequest` 直接从 assets 读 `index.html`，IndexedDB / localStorage 有稳定 origin（`file://` 在部分机型上禁用存储），且**不需要 androidx 依赖** |
| `onShowFileChooser` | 支持一次选多个 md / zip；`ACTION_OPEN_DOCUMENT` + `EXTRA_ALLOW_MULTIPLE` |
| `AndroidSaver` | JS 桥 `AndroidSaver.saveText(name, mime, text)`：备份 JSON 写入系统「下载/MD Flashcards」（API 29+ 用 MediaStore，低版本写应用外部目录） |
| 返回键 | 先关弹层，再回上一视图（`window.history.back()`），最后退出 |
| INTERNET 权限 | 只用于可选的 AI API 调用（用户自备 key）；其余功能完全离线 |
| `usesCleartextTraffic` | 允许本机 Ollama 等 `http://` 接口 |
| 零第三方依赖 | `app/build.gradle.kts` 的 dependencies 为空，APK 里只有网页 + 一个 Activity |

## 注意

- `dist/md-flashcards.html` 不在仓库里时构建会失败 —— 先跑 `python scripts/build.py`；
- 升级内置题库或网页功能后重新构建 APK 即可，用户数据在 WebView 的本地存储里，覆盖安装不会清空（除非卸载）；
- 如果要离线/内网分发，debug APK 足够；上架需 release 签名并配置 `versionCode` 递增。
