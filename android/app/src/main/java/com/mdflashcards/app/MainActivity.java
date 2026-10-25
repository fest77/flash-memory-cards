package com.mdflashcards.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.nio.charset.Charset;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import java.nio.charset.Charset;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

/**
 * 最小 WebView 壳（零第三方依赖）：
 *  - 用一个虚拟 https origin（appassets.androidplatform.net）承载 assets/index.html，
 *    由 shouldInterceptRequest 直接从 assets 返回。这样 IndexedDB / localStorage 有稳定 origin，
 *    又不依赖 androidx WebViewAssetLoader，便于用纯 JDK + Android SDK 构建。
 *  - 实现 onShowFileChooser，手机端也能一次选多个 md / zip。
 *  - AndroidSaver 桥：备份 JSON 直接写入系统「下载」目录。
 *  - 返回键优先关弹层 / 回上一视图，再退出。
 */
public class MainActivity extends Activity {

    private static final int REQ_PICK_FILES = 1001;
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private long pausedAt = 0; // 后台时间戳：>5 分钟回前台要求解锁
    private static final long LOCK_AFTER_MS = 5 * 60 * 1000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri == null ? null : uri.getScheme();
                String host = uri == null ? null : uri.getHost();
                boolean internal = scheme != null && "https".equals(scheme) && ASSET_HOST.equals(host);
                if (!internal) {
                    // 本地页面以外的一切链接（mailto:/tel:/外部 http(s)）都交给系统：
                    // ① WebView 认识 mailto 失败的问题；② 外部网页不得进入本 WebView（那里有 AndroidSaver 桥）
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "未找到可以打开该链接的应用", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return false;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && ASSET_HOST.equals(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || "/".equals(path) || "/index.html".equals(path)) {
                        try {
                            InputStream is = getAssets().open("index.html");
                            return new WebResourceResponse("text/html", "utf-8", is);
                        } catch (IOException e) {
                            return new WebResourceResponse("text/plain", "utf-8",
                                    new ByteArrayInputStream("index.html missing from APK assets".getBytes(StandardCharsets.UTF_8)));
                        }
                    }
                    return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
                }
                return null;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }
                pendingFileCallback = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "text/plain",
                            "text/markdown",
                            "application/zip",
                            "application/x-zip-compressed",
                            "application/json",
                            "application/octet-stream",
                            "image/png",
                            "image/jpeg",
                            "image/gif",
                            "image/webp",
                            "image/bmp",
                            "image/svg+xml",
                            "image/heic"
                    });
                    startActivityForResult(intent, REQ_PICK_FILES);
                    return true;
                } catch (Exception e) {
                    pendingFileCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }
        });

        webView.addJavascriptInterface(new SaverBridge(), "AndroidSaver");
        ensureNotificationChannel();
        requestNotificationPermissionIfNeeded();
        webView.loadUrl(START_URL);
        // PIN 已设置则先锁
        if (pinIsSet()) showPinLock();
        handleExternalIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleExternalIntent(intent);
    }

    /** Android 13+ 需要运行时申请 POST_NOTIFICATIONS（每日提醒依赖它）。 */
    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 3301);
            }
        }
    }

    /** ACTION_SEND / ACTION_VIEW：读出 .md/.zip 内容，base64 交给 Web 端导入预览。 */
    private void handleExternalIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        String name = "import.md";
        if (Intent.ACTION_SEND.equals(action)) {
            if (intent.getExtras() != null && intent.getStringExtra(Intent.EXTRA_TEXT) != null) {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                final String b64 = Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
                pushExternalImport(b64, "shared.md");
                return;
            }
            uri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        }
        if (uri == null) return;
        try {
            name = uri.getLastPathSegment();
            if (name == null || !name.matches(".*\\.(md|markdown|txt|zip)$")) name = "import.md";
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            java.io.InputStream is = getContentResolver().openInputStream(uri);
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            is.close();
            final String b64 = Base64.getEncoder().encodeToString(bos.toByteArray());
            pushExternalImport(b64, name);
        } catch (Exception e) {
            Toast.makeText(this, "无法读取分享的文件", Toast.LENGTH_SHORT).show();
        }
    }

    private void pushExternalImport(final String b64, final String name) {
        // 冷启动时 Web 端可能还没挂上 __externalImport：最多重试 10 次（约 6 秒）
        pushExternalImportRetry(b64, name, 0);
    }

    private void pushExternalImportRetry(final String b64, final String name, final int attempt) {
        if (webView == null) return;
        // 文件名走 JSON 转义，避免引号/反斜杠注入
        final String jsName = org.json.JSONObject.quote(name == null ? "import.md" : name);
        final String call = "(function(){return typeof window.__externalImport==='function';})()";
        new Handler(Looper.getMainLooper()).postDelayed(() -> webView.evaluateJavascript(call, value -> {
            boolean ready = value != null && value.contains("true");
            if (ready) {
                webView.evaluateJavascript("window.__externalImport(" + jsName + ",'" + b64 + "')", null);
            } else if (attempt < 10) {
                pushExternalImportRetry(b64, name, attempt + 1);
            } else {
                Toast.makeText(MainActivity.this, "导入准备超时，请在应用内手动导入", Toast.LENGTH_LONG).show();
            }
        }), attempt == 0 ? 600 : 400);
    }

    /* ---------- PIN 应用锁（本地盐+SHA，Web 端存哈希；原生只做门帘） ---------- */
    private SharedPreferences prefs() { return getSharedPreferences("mdfc", MODE_PRIVATE); }
    private boolean pinIsSet() { return prefs().getString("pinHash", null) != null; }

    /** 轮询 JS 侧清理完成标志（最多约 8 秒），完成后再清 PIN 并重建。 */
    private void pollWipeThenRecreate(final android.app.Dialog dlg, final int attempt) {
        if (webView == null) return;
        webView.evaluateJavascript("window.__wipeDone||'pending'", value -> {
            boolean done = value != null && (value.contains("ok") || value.contains("err") || value.contains("blocked"));
            if (done || attempt >= 40) {
                prefs().edit().clear().apply();
                dlg.dismiss();
                recreate();
            } else {
                new Handler(Looper.getMainLooper()).postDelayed(() -> pollWipeThenRecreate(dlg, attempt + 1), 200);
            }
        });
    }

    private void showPinLock() {
        // 极简锁屏：WebView 上盖系统对话框输入 PIN，正确才放行（哈希校验走 Web 端同一份存储不可行——原生侧独立存）
        android.app.Dialog dlg = new android.app.Dialog(this);
        dlg.setContentView(getLayoutInflater().inflate(R.layout.pin_lock, null));
        dlg.setCancelable(false);
        dlg.findViewById(R.id.pinGo).setOnClickListener(v -> {
            String input = ((android.widget.EditText) dlg.findViewById(R.id.pinInput)).getText().toString();
            String salt = prefs().getString("pinSalt", "");
            String hash = pinHash(input, salt);
            if (hash.equals(prefs().getString("pinHash", ""))) {
                dlg.dismiss();
            } else {
                Toast.makeText(this, "PIN 错误", Toast.LENGTH_SHORT).show();
            }
        });
        dlg.findViewById(R.id.pinForgot).setOnClickListener(v -> {
            new android.app.AlertDialog.Builder(this)
                .setMessage("忘记 PIN 将清除应用全部数据（含笔记与进度），确定？")
                .setPositiveButton("清除", (d, w) -> {
                    // evaluateJavascript 不会 await Promise：改为 JS 侧完成后置标志，原生轮询该标志
                    final String clearJs =
                        "(function(){window.__wipeDone='pending';try{localStorage.clear();}catch(e){}" +
                        "try{var rq=indexedDB.deleteDatabase('md-review');" +
                        "rq.onsuccess=function(){window.__wipeDone='ok'};" +
                        "rq.onerror=function(){window.__wipeDone='err'};" +
                        "rq.onblocked=function(){window.__wipeDone='blocked'};" +
                        "}catch(e){window.__wipeDone='err'}})()";
                    webView.evaluateJavascript(clearJs, null);
                    pollWipeThenRecreate(dlg, 0);
                })
                .setNegativeButton("取消", null).show();
        });
        dlg.show();
    }

    static String pinHash(String pin, String salt) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest((salt + ":" + pin).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { return ""; }
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = System.currentTimeMillis();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pinIsSet() && pausedAt > 0 && System.currentTimeMillis() - pausedAt > LOCK_AFTER_MS) {
            showPinLock();
        }
        pausedAt = 0;
    }

    /* ---------- 每日提醒（AlarmManager + 通知，完全本地） ---------- */
    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel("review", "复习提醒", NotificationManager.IMPORTANCE_DEFAULT));
        }
    }

    private void scheduleReminder(int hour, int minute) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, hour);
        cal.set(java.util.Calendar.MINUTE, minute);
        cal.set(java.util.Calendar.SECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(java.util.Calendar.DATE, 1);
        PendingIntent pi = PendingIntent.getBroadcast(this, 2001,
            new Intent(this, ReminderReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        am.setRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
        prefs().edit().putString("reminder", hour + ":" + minute).apply();
    }

    private void cancelReminder() {
        PendingIntent pi = PendingIntent.getBroadcast(this, 2001,
            new Intent(this, ReminderReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        ((AlarmManager) getSystemService(ALARM_SERVICE)).cancel(pi);
        prefs().edit().remove("reminder").apply();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_PICK_FILES) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(results);
            pendingFileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(function(){"
                        + "var m=document.getElementById('modal');"
                        + "if(m&&!m.classList.contains('hidden')){"
                        + "var b=document.querySelector('[data-act=\"close-modal\"]');if(b)b.click();return 'modal';}"
                        + "if(document.querySelector('.view.active')&&!document.querySelector('#view-home.active')){"
                        + "window.history.back();return 'view';}"
                        + "return 'home';})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || value.contains("home")) {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** 保存/分享桥：文本与二进制写入「下载/MD Flashcards」，zip 等支持系统分享。 */
    public class SaverBridge {

        /** 统一写入：返回写入的 Uri（API 29+ MediaStore）或文件路径（低版本），失败返回 null。 */
        private Uri writeBytes(String filename, String mime, byte[] bytes) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + "/MD Flashcards");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        return null;
                    }
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) {
                        return null;
                    }
                    try {
                        os.write(bytes);
                    } finally {
                        os.close();
                    }
                    return uri;
                }
                File dir = new File(getExternalFilesDir(null), "Downloads");
                if (!dir.exists() && !dir.mkdirs()) {
                    return null;
                }
                File out = new File(dir, filename);
                FileOutputStream fos = new FileOutputStream(out);
                try {
                    fos.write(bytes);
                } finally {
                    fos.close();
                }
                return Uri.fromFile(out);
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public boolean saveText(String filename, String mime, String text) {
            return writeBytes(filename, mime, text.getBytes(StandardCharsets.UTF_8)) != null;
        }

        /** 二进制保存（zip 备份等）：base64 输入。 */
        @JavascriptInterface
        public boolean saveBinary(String filename, String mime, String base64) {
            try {
                byte[] bytes = Base64.getDecoder().decode(base64);
                return writeBytes(filename, mime, bytes) != null;
            } catch (Exception e) {
                return false;
            }
        }

        /** Web 端设置/移除 PIN（原生侧存哈希用于门帘校验）。 */
        @JavascriptInterface
        public boolean pinSet(String pin) {
            if (pin == null || !pin.matches("\\d{4}")) return false;
            String salt = Long.toHexString(System.currentTimeMillis());
            prefs().edit()
                .putString("pinSalt", salt)
                .putString("pinHash", MainActivity.pinHash(pin, salt))
                .apply();
            return true;
        }

        @JavascriptInterface
        public void pinRemove() { prefs().edit().remove("pinHash").remove("pinSalt").apply(); }

        @JavascriptInterface
        public boolean reminderSet(int hour, int minute) {
            scheduleReminder(hour, minute);
            return true;
        }

        @JavascriptInterface
        public void reminderCancel() { cancelReminder(); }

        /** 保存后立即弹出系统分享（发送给微信/文件管理等）。 */
        @JavascriptInterface
        public boolean shareFile(String filename, String mime, String base64) {
            try {
                Uri uri = writeBytes("share-" + filename, mime, Base64.getDecoder().decode(base64));
                if (uri == null) {
                    return false;
                }
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, filename);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(chooser);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
