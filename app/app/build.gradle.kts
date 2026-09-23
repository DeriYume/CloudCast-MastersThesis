import java.io.ByteArrayOutputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Read API_URL from a .env file at the project root. Gradle does not read .env automatically
// Parse here and inject the value into BuildConfig.
val apiUrl: String = run {
    val envFile = rootProject.file("../.env")
    val props = Properties()
    if (envFile.exists()) {
        envFile.inputStream().use { props.load(it) }
    }
    val raw = (props.getProperty("API_URL")
        ?: error("API_URL is missing - copy .env.example to .env and set your gateway URL"))
        .trim()
        .trim('"')
    if (raw.endsWith("/")) raw else "$raw/"
}

val lifecycleVersion = "2.8.7"

configurations.configureEach {
    resolutionStrategy.eachDependency {
        if (requested.group == "androidx.lifecycle") useVersion(lifecycleVersion)
    }

    exclude(group = "androidx.lifecycle", module = "lifecycle-viewmodel-ktx")
    exclude(group = "androidx.lifecycle", module = "lifecycle-livedata-core-ktx")
}

android {
    namespace = "com.cloudcast.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.cloudcast.app"
        minSdk = 33
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        // Exposed to Kotlin as BuildConfig.API_URL
        buildConfigField("String", "API_URL", "\"$apiUrl\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }

    sourceSets.getByName("androidTest") {
        assets.srcDir(layout.buildDirectory.dir("generated/testVectors"))
        assets.srcDir(layout.buildDirectory.dir("generated/srpVectors"))
    }
    sourceSets.getByName("test") {
        resources.srcDir(layout.buildDirectory.dir("generated/srpVectors"))
    }
}

val syncTestVectors by tasks.registering(Copy::class) {
    from(File(rootProject.projectDir.parentFile, "crypto-core/test-vectors.json"))
    into(layout.buildDirectory.dir("generated/testVectors"))
}

val syncSrpVectors by tasks.registering(Copy::class) {
    from(File(rootProject.projectDir.parentFile, "crypto-core/srp-vectors.json"))
    into(layout.buildDirectory.dir("generated/srpVectors"))
}
tasks.withType<org.gradle.api.tasks.testing.Test>().configureEach { dependsOn(syncSrpVectors) }
tasks.matching { it.name.startsWith("process") && it.name.contains("UnitTestJavaRes") }
    .configureEach { dependsOn(syncSrpVectors) }
tasks.matching { it.name.startsWith("generate") && it.name.contains("AndroidTestAssets") }
    .configureEach { dependsOn(syncTestVectors, syncSrpVectors) }
tasks.named("preBuild").configure { dependsOn(syncTestVectors, syncSrpVectors) }

dependencies {
    // --- Compose ---
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // --- AndroidX / lifecycle / activity / navigation ---
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.documentfile:documentfile:1.0.1")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")

    implementation("androidx.lifecycle:lifecycle-runtime-ktx:$lifecycleVersion")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:$lifecycleVersion")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$lifecycleVersion")

    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // --- Media3 (video preview) ---
    implementation("androidx.media3:media3-exoplayer:1.4.1")
    implementation("androidx.media3:media3-ui:1.4.1")

    // --- Networking ---
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // --- Persistence (token storage) ---
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // --- Crypto ---
    implementation("com.goterl:lazysodium-android:5.2.0@aar")
    implementation("net.java.dev.jna:jna:5.19.1@aar")

    // --- Tests ---
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    testImplementation("junit:junit:4.13.2")

    // --- Camera + barcode scanning (QR scan-to-sign-in) ---
    implementation("androidx.camera:camera-core:1.4.1")
    implementation("androidx.camera:camera-camera2:1.4.1")
    implementation("androidx.camera:camera-lifecycle:1.4.1")
    implementation("androidx.camera:camera-view:1.4.1")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
}
// --- Codegen ---
val isWindows = System.getProperty("os.name").lowercase().contains("win")
val repoRoot = rootProject.projectDir.parentFile

val nodeAvailable: Boolean = try {
    ProcessBuilder(if (isWindows) listOf("cmd", "/c", "node", "--version") else listOf("node", "--version"))
        .redirectErrorStream(true)
        .start()
        .let { it.inputStream.readBytes(); it.waitFor() == 0 }
} catch (_: Exception) {
    false
}

if (!nodeAvailable) {
    logger.warn(
        "codegen: node not found - building against the committed generated files. " +
            "Install Node if you change theme/colors.json, theme/logo.json, shared/contract.json or shared/formats.json.",
    )
}

fun Project.registerCodegen(name: String, script: String, what: String) =
    tasks.register(name, Exec::class) {
        onlyIf { nodeAvailable }
        workingDir = repoRoot
        commandLine(if (isWindows) listOf("cmd", "/c", "node", script) else listOf("node", script))
        isIgnoreExitValue = true
        errorOutput = ByteArrayOutputStream()

        doFirst { logger.lifecycle("codegen: regenerating $what from $script") }
        doLast {
            val code = executionResult.get().exitValue
            if (code != 0) {
                throw GradleException(
                    "codegen: $script failed (exit $code). The committed $what may now be " +
                        "stale, so the build is stopped rather than run against it.\n" +
                        errorOutput.toString().trim(),
                )
            }
        }
    }

val generateThemeTokens = registerCodegen("generateThemeTokens", "theme/generate.mjs", "design tokens")
val generateContract = registerCodegen("generateContract", "shared/generate.mjs", "API contract")

tasks.named("preBuild").configure { dependsOn(generateThemeTokens, generateContract) }
