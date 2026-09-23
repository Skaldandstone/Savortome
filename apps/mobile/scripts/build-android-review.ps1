param(
    [ValidateSet('account-preview', 'guest-preview')]
    [string]$Configuration = 'account-preview',
    [string]$ApiBaseUrl = 'https://savortome.skaldandstone.com',
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidHome = $env:ANDROID_HOME,
    [string]$NativeStaging = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.sb-native'),
    [string]$NinjaExecutable,
    [ValidateSet('arm64-v8a', 'x86_64')]
    [string]$Architecture = 'arm64-v8a',
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*\.apk$')]
    [string]$ArtifactName = 'savortome-arm64-review.apk',
    [switch]$SkipPrebuild
)
$ErrorActionPreference = 'Stop'
$mobileRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Provide -JavaHome pointing to JDK 21.' }
if (!(Test-Path -LiteralPath (Join-Path $AndroidHome 'platform-tools/adb.exe'))) { throw 'Provide -AndroidHome pointing to the Android SDK.' }
if (!(Test-Path -LiteralPath $NinjaExecutable)) { throw 'Provide -NinjaExecutable pointing to the task-local verified Ninja 1.13.2 executable. See android-evidence.md.' }
$javaVersion = & (Join-Path $JavaHome 'bin/java.exe') --version | Out-String
if ($javaVersion -notmatch '(openjdk|java) 21\.') { throw 'This Windows review build recipe requires JDK 21.' }
if ($Configuration -eq 'account-preview') {
    $configuredKey = $env:EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
    if (!$configuredKey) {
        $envFile = Join-Path $mobileRoot '.env'
        if (Test-Path -LiteralPath $envFile) {
            $keyLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=' } | Select-Object -First 1
            if ($keyLine) { $configuredKey = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'") }
        }
    }
    if ($configuredKey -notmatch '^pk_test_') { throw 'Account preview requires a test Clerk publishable key in the process environment or apps/mobile/.env. No key is printed.' }
}
# These variables affect only this shell and its children. Run this script in a fresh PowerShell process.
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:EXPO_PUBLIC_WOODLAND_BETA = 'true'
$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl
$env:SECONDS_NATIVE_STAGING = $NativeStaging
$env:SECONDS_NINJA_EXECUTABLE = $NinjaExecutable
$env:CMAKE_BUILD_PARALLEL_LEVEL = '2'
$env:NODE_ENV = 'production'
if ($Configuration -eq 'guest-preview') {
    $env:EXPO_NO_DOTENV = '1'
    $env:EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = ''
} else {
    Remove-Item Env:\EXPO_NO_DOTENV -ErrorAction SilentlyContinue
    $env:EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = $configuredKey
}
# Gradle does not normally track Metro's public environment. Switching between
# guest/account preview must rebuild the bundle. Only a digest is a task input.
$bundleInputs = @($Configuration, $Architecture, $env:EXPO_PUBLIC_WOODLAND_BETA, $env:EXPO_PUBLIC_API_BASE_URL, $env:EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) -join "`n"
$digest = [System.Security.Cryptography.SHA256]::Create()
try { $env:SECONDS_BUNDLE_CONFIGURATION = ([BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($bundleInputs)))).Replace('-', '').ToLowerInvariant() }
finally { $digest.Dispose(); $bundleInputs = $null }
Push-Location -LiteralPath $mobileRoot
try {
    if (!$SkipPrebuild) {
        & node (Join-Path $mobileRoot 'node_modules/expo/bin/cli') prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
    }
    Push-Location -LiteralPath (Join-Path $mobileRoot 'android')
    try {
        & .\gradlew.bat :app:assembleRelease --no-daemon --max-workers=1 -I '../scripts/windows-native.init.gradle' '-Pkotlin.compiler.execution.strategy=in-process' "-PreactNativeArchitectures=$Architecture" '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8'
        if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }
    } finally { Pop-Location }
    $artifactRoot = Join-Path $mobileRoot ".expo-export/$Configuration"
    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    $artifact = Join-Path $artifactRoot $ArtifactName
    Copy-Item -LiteralPath (Join-Path $mobileRoot 'android/app/build/outputs/apk/release/app-release.apk') -Destination $artifact
    Get-FileHash -LiteralPath $artifact -Algorithm SHA256
    Write-Warning "REVIEW ONLY: generated Expo release for $Architecture uses the public Android debug signing key. Not a cohort distribution build. No account, emulator or physical-device validation is implied."
} finally { Pop-Location }
