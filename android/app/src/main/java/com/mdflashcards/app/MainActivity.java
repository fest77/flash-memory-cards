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
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setWebViewClient(new WebViewClient() {
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
        webView.loadUrl(START_URL);
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

    /** 备份 JSON 写入系统「下载」目录（API 29+ 用 MediaStore，低版本写应用外部目录）。 */
    public class SaverBridge {
        @JavascriptInterface
        public boolean saveText(String filename, String mime, String text) {
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + "/MD Flashcards");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        return false;
                    }
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) {
                        return false;
                    }
                    try {
                        os.write(bytes);
                    } finally {
                        os.close();
                    }
                    return true;
                }
                File dir = new File(getExternalFilesDir(null), "Downloads");
                if (!dir.exists() && !dir.mkdirs()) {
                    return false;
                }
                File out = new File(dir, filename);
                FileOutputStream fos = new FileOutputStream(out);
                try {
                    fos.write(bytes);
                } finally {
                    fos.close();
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
