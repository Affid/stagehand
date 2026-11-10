// Phase 0 spike of docs/ANDROID-APP-PLAN.md: a throwaway app that loads a
// Foundry server in a WebView and probes the risky parts. Not the real app.
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
rootProject.name = "stagehand-android-spike"
include(":app")
