// The app module. Its web part is the extension package's app build
// (packages/extension/dist-app, made by `pnpm build`), copied into the APK's
// assets without source maps. The version is the extension's.
import groovy.json.JsonSlurper
import java.util.Properties
import javax.inject.Inject

plugins {
    id("com.android.application")
}

val extensionDir = rootProject.layout.projectDirectory.dir("../extension")

/** The extension's manifest version, which the app shares ("0.2.0"). */
val appVersion: String = run {
    val manifest = extensionDir.file("static/manifest.json").asFile
    @Suppress("UNCHECKED_CAST")
    val json = JsonSlurper().parse(manifest) as Map<String, Any>
    json["version"] as String
}

/** 0.2.0 -> 200: each part below 100. */
fun versionCodeOf(version: String): Int {
    val parts = version.split(".").map { it.toIntOrNull() }
    require(parts.size == 3 && parts.all { it != null && it in 0..99 }) {
        "The app needs a version like 1.2.3, each part below 100: $version"
    }
    return parts.fold(0) { code, part -> code * 100 + part!! }
}

/**
 * The release key lives outside the repository: a properties file named by
 * ST_ANDROID_SIGNING, else ~/.config/stagehand/android-signing.properties
 * (storeFile, storePassword, keyAlias, keyPassword). Without it the release
 * APK is built unsigned.
 */
val signingProps: Properties? = run {
    val path = System.getenv("ST_ANDROID_SIGNING")
        ?: "${System.getProperty("user.home")}/.config/stagehand/android-signing.properties"
    val file = File(path)
    if (!file.isFile) {
        logger.warn("No release signing file at $path: the release APK is unsigned")
        null
    } else {
        Properties().apply { file.inputStream().use { load(it) } }
    }
}

/** One setting of the signing file; names the missing key, never a value. */
fun Properties.required(key: String): String =
    getProperty(key) ?: error("The release signing file has no $key")

/** Copies dist-app/ into generated assets, without source maps. */
abstract class CopyWebAssets : DefaultTask() {
    // Not @InputDirectory: Gradle would refuse a missing dist-app before the
    // action could say how to make it (review).
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val source: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun copy() {
        val from = source.get().asFile
        check(from.resolve("app-setup.js").isFile) {
            "No app build in $from: run `pnpm build` first"
        }
        fs.sync {
            from(from)
            into(outputDir)
            exclude("**/*.map")
        }
    }
}

val copyWebAssets = tasks.register<CopyWebAssets>("copyWebAssets") {
    source.set(extensionDir.dir("dist-app"))
    outputDir.set(layout.buildDirectory.dir("generated/webassets"))
}

android {
    namespace = "io.github.affid.stagehand"
    compileSdk = 36

    defaultConfig {
        // The app's identity on a device; fixed once anyone installs a release.
        applicationId = "io.github.affid.stagehand"
        minSdk = 26
        targetSdk = 36
        versionCode = versionCodeOf(appVersion)
        versionName = appVersion
    }

    signingConfigs {
        signingProps?.let { p ->
            create("release") {
                storeFile = File(p.required("storeFile"))
                storePassword = p.required("storePassword")
                keyAlias = p.required("keyAlias")
                keyPassword = p.required("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            enableUnitTestCoverage = true
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        // BuildConfig.DEBUG turns on WebView debugging in debug builds only.
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// The JVM's HttpURLConnection drops headers it calls restricted (Origin,
// Sec-*); Android's sends them. Unit tests run on the JVM, so they let it
// send them too, and check what our login really sends (AdminLoginTest).
tasks.withType<Test>().configureEach {
    systemProperty("sun.net.http.allowRestrictedHeaders", "true")
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebAssets, CopyWebAssets::outputDir)
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.browser:browser:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}
