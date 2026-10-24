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
        versionCode = 9
        versionName = "1.7.2"
    }

    buildTypes {
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
    implementation("androidx.webkit:webkit:1.11.0")
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
