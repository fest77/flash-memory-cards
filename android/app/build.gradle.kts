import org.gradle.api.tasks.Copy

plugins {
    id("com.android.application")
}

android {
    namespace = "com.mdflashcards.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mdflashcards.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 37
        versionName = "1.12.13"
    }

    // 固定的调试签名：debug.keystore 随仓库提交（debug 密钥按惯例不是机密），
    // 保证任何机器/CI 上打出的 APK 签名一致，新版本可以直接覆盖安装，不用卸载重装丢数据
    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
}

// 把单文件网页复制进 APK 的 assets，运行时以 https://appassets.androidplatform.net/ 提供，
// 这样 IndexedDB / localStorage 有稳定 origin，不会被 file:// 的存储限制影响。
val copyWebAssets = tasks.register<Copy>("copyWebAssets") {
    from(rootProject.file("../dist/md-flashcards.html"))
    into(layout.projectDirectory.dir("src/main/assets"))
    rename { "index.html" }
}

tasks.named("preBuild") {
    dependsOn(copyWebAssets)
}
