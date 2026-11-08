// The Module Library Android app (docs/ANDROID-APP-PLAN.md, phase 4): a
// WebView host for the Setup page built in packages/extension (dist-app/).
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "module-library-android"
include(":app")
