plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.affid.stagehand.spike"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.affid.stagehand.spike"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1-spike"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
    implementation("androidx.activity:activity-ktx:1.13.0")
}
