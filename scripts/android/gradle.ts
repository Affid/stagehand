// Runs the Android app's Gradle build (packages/android) with the JDK and
// SDK it needs: JDK 21 (AGP refuses the system's Java 25) and the Android
// SDK in WSL (docs/ANDROID-SPIKE.md, "Tooling").
// Usage: node scripts/android/gradle.ts <gradle tasks...>
// Overrides: ML_ANDROID_JAVA_HOME (a JDK 17-21), ANDROID_HOME (the SDK).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const PROJECT = join(ROOT, "packages", "android");

/** The newest JDK 21 under ~/opt (any patch release). */
function defaultJdk(): string {
  const opt = join(homedir(), "opt");
  const found = existsSync(opt)
    ? readdirSync(opt)
        .filter((name) => name.startsWith("jdk-21"))
        .sort()
        .reverse()
    : [];
  return join(opt, found[0] ?? "jdk-21");
}

const javaHome = process.env.ML_ANDROID_JAVA_HOME ?? defaultJdk();
const sdk = process.env.ANDROID_HOME ?? join(homedir(), "Android", "Sdk");

if (!existsSync(join(javaHome, "bin", "java")))
  throw new Error(`No JDK at ${javaHome}: set ML_ANDROID_JAVA_HOME`);
if (!existsSync(join(sdk, "platforms")))
  throw new Error(`No Android SDK at ${sdk}: set ANDROID_HOME`);

// The SDK's path for Gradle; machine-specific, git-ignored.
const local = join(PROJECT, "local.properties");
const sdkLine = `sdk.dir=${sdk}\n`;
if (!existsSync(local) || readFileSync(local, "utf8") !== sdkLine)
  writeFileSync(local, sdkLine);

const tasks = process.argv.slice(2);
if (tasks.length === 0) throw new Error("Name the Gradle tasks to run");

const result = spawnSync(
  join(PROJECT, "gradlew"),
  [...tasks, "--console=plain"],
  {
    cwd: PROJECT,
    stdio: "inherit",
    env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
