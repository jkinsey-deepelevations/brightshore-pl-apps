# Private-label Mortgage Servicing App

This repository contains shared Expo/React Native code for multiple separately
branded iOS and Android apps. BrightShore is the default brand; Essex and
Cornerstone First Mortgage are additional configured private labels.

## Clone onto a new Mac

Install Xcode from the App Store, then install the command-line prerequisites
and clone this repository:

```sh
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node cocoapods
git clone https://github.com/jkinsey-deepelevations/brightshore-pl-apps.git
cd brightshore-pl-apps
npm ci
```

Start the default BrightShore app with `npm run start:brightshore`. For a local
iOS native build, finish the CocoaPods setup and open the workspace:

```sh
cd ios
pod install
open BrightShoreMortgage.xcworkspace
```

Generated dependencies and local credentials are intentionally not committed.
The reproducible dependency versions are captured in `package-lock.json`, and
`npm ci` restores the JavaScript dependencies after every fresh clone.

## Brand selection

Brand-specific store identity, URLs, contact details, colors, and build assets
live in `brands/`. Runtime image imports live in `brandAssets.ts` because Metro
requires static image paths. `app.config.ts` selects a brand using `APP_BRAND`,
and the JavaScript bundle uses the matching `EXPO_PUBLIC_APP_BRAND` value.

Resolve or start any configuration locally:

```sh
npm run config:brightshore
npm run config:essex
npm run config:cornerstone
npm run start:brightshore
npm run start:essex
npm run start:cornerstone
```

Build any private-label app with EAS:

```sh
npx eas-cli@latest build --platform all --profile brightshore-production
npx eas-cli@latest build --platform all --profile essex-production
npx eas-cli@latest build --platform all --profile cornerstone-production
```

The EAS profiles set both brand variables. Do not invoke an Essex or Cornerstone
store build with the generic `production` profile; that profile intentionally
remains a BrightShore-compatible default.

The checked-in `ios/` and `android/` folders remain the existing BrightShore
native projects for Xcode Cloud and local native work. `.easignore` excludes
them from EAS uploads, so EAS uses Continuous Native Generation and applies the
selected brand's identifiers and assets from `app.config.ts`. Running
`expo run:ios` or `expo run:android` locally does not switch the checked-in
native project to another brand. Use the brand-specific EAS profiles, or run
`expo prebuild` in a clean generated workspace, for private-label native builds.

The current shared runtime is intentionally based on the newer BrightShore
implementation. Brand selection now covers identity, assets, and destinations.
BrightShore and Essex load the authenticated servicing portal directly in the
main WebView. Cornerstone uses direct eStatus login on iOS and retains the
public site's embedded account portal on Android. The large
WebView-polishing block and app-store screenshot generator still contain
BrightShore-specific behavior; those should be reconciled separately when the
desired Essex core behavior is chosen.

Cornerstone loads public servicing content from
`https://cfmtg.accountaccessnow.com/` and authenticated account content from
`https://servicingbranch.estatusconnect.com/`. Its drawer routes map to the
public site's Manage Your Mortgage, Transferred to Cornerstone, Mortgage
Assistance, Contact Us, and Learning Center pages. `cfmtg.com` is a visual brand
reference, not an in-app WebView destination.

Cornerstone's iOS Login tab and public website account links open
`https://servicingbranch.estatusconnect.com/User/Login` in the main WebView.
Android retains `https://cfmtg.accountaccessnow.com/manage?portal=account`.
The home page and Pay as Guest destinations remain on the public website.

Native architecture is shared rather than branded. Every current build uses
`newArchEnabled: false`, matching the tested BrightShore runtime and its native
cookie/document-viewer dependencies. Essex's former standalone config used the
New Architecture, but that historical setting is not carried into this shared
application.

ATT support is also part of the shared build configuration. The
`expo-tracking-transparency` plugin writes the brand-specific usage message,
the shared runtime requests and applies the user's permission before loading
the WebView, and `ios.privacyManifests` generates the required tracking and
required-reason declarations. Each brand owns its `trackingDomains` list in its
brand configuration; keep that list synchronized with the tracking services
actually contacted by that brand's websites.

## Configured store identities

BrightShore:

- iOS bundle identifier: `com.brightshoremortgage.app`
- Android package: `com.brightshoremortgage.app`
- Expo slug: `brightshore-servicing`
- Expo/EAS project ID: `5e9d4eee-d490-453e-b619-17643137965f`
- App version: `1.0`
- Current live iOS build: `8`
- Current live Android version code: `13`
- Future production increments: managed by EAS remote versioning

The supplied App Store Connect and Google Play records currently show the
listing name `Brightshore Servicing`, while the shared Expo config and
checked-in native projects use `BrightShore Mortgage`. Confirm the intended
customer-facing name before the next store build; changing it should be an
explicit brand decision rather than an incidental private-label change.

Essex:

- iOS bundle identifier: `com.essexservicing.app`
- Android package: `com.essexservicing.app`
- Expo slug: `essex-servicing-app`
- Expo/EAS project ID: `ef50d6ef-2f92-4922-b98e-679f61df082c`
- App version: `1.1.2`
- Current live iOS build: `37`
- Current live Android version code: `4`
- EAS remote counters were initialized to those live values on August 19, 2026

If those counters ever need to be repaired or moved to a different Expo
project, reset them interactively before another production build:

```sh
npx eas-cli@latest build:version:set -p ios -e essex-production
# Enter 37 when prompted.
npx eas-cli@latest build:version:set -p android -e essex-production
# Enter 4 when prompted.
```

With `autoIncrement: true`, the next Essex production artifacts will then use
iOS build `38` and Android version code `5`.

Cornerstone First Mortgage:

- iOS bundle identifier: `com.cfmtg.servicing`
- Android package: `com.cfmtg.servicing`
- Expo slug: `cornerstone-servicing-app`
- Expo/EAS project ID: `7c5be7c0-3264-4c65-8033-7decb85945fd`
- App version: `1.0.0`
- Corrected iOS Simulator/App Store builds: build `3`
- Corrected Android screenshot APK/Google Play AAB: version code `3`

The current Cornerstone EAS/store handoff status and permanent build-page links
are recorded in `docs/CORNERSTONE_RELEASE.md`.

## GitHub Actions and EAS

The repository includes two GitHub workflows:

- `.github/workflows/ci.yml` runs dependency install, TypeScript, and Expo config validation on pull requests and pushes to `main`.
- `.github/workflows/eas-release.yml` triggers Android production EAS builds on pushes to `main` and supports a manual `workflow_dispatch` run for Android, iOS, or both platforms with optional store submission.

Before the release workflow can run, add this repository secret in GitHub:

- `EXPO_TOKEN`: an Expo access token for the Expo account that owns `@jkinsey-deepelevations/brightshore-servicing`.

Create the token from the Expo dashboard:

1. Sign in at https://expo.dev.
2. Open the account or organization that owns `@jkinsey-deepelevations/brightshore-servicing`.
3. Go to Access tokens.
4. Create a personal access token or, preferably for CI, a robot user token with permission to build this project.
5. Copy the token once. Expo will not show it again.
6. In GitHub, open this repo, then Settings > Secrets and variables > Actions > New repository secret.
7. Name it `EXPO_TOKEN` and paste the Expo token as the value.

Make sure it is an Actions repository secret, not a Codespaces secret, Dependabot secret, or environment-only secret. The EAS Release workflow checks for this secret before starting the build.

Each brand is linked to its own Expo/EAS project through the dynamic
`expo.extra.eas.projectId` in `app.config.ts`.

The native `ios/` and `android/` projects are intentionally checked in for BrightShore Xcode Cloud and native signing workflows. Because those local projects are not dynamically switched, update their matching native files when changing BrightShore identifiers, icons, splash assets, permissions, or architecture flags. EAS cloud builds instead use CNG and the selected brand configuration.

Those checked-in native projects still contain developer build number/version
code `1`. They do not affect EAS because `.easignore` excludes them, but a
direct Xcode/Xcode Cloud upload must use iOS build `9` or later and a direct
Android Studio upload must use version code `14` or later to exceed the current
live BrightShore builds.

This app currently runs Expo SDK 54 with React Native's legacy architecture (`newArchEnabled: false`). That keeps the authenticated cookie/document-viewer native packages on the safer build path. Expo SDK 54 is the last SDK where this can be disabled, so migrate `@react-native-cookies/cookies` and `react-native-file-viewer` before upgrading to SDK 55 or later.

Run one interactive EAS production build per platform before relying on CI for that platform. This lets EAS confirm the project and collect/create credentials:

```sh
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

The first iOS production build must be interactive because EAS needs to create or select the Apple Distribution Certificate and provisioning profile. After that credential setup exists on EAS, GitHub Actions can run iOS builds non-interactively.

This project uses EAS remote app versioning through `cli.appVersionSource: "remote"` in `eas.json`, so EAS manages developer-facing build numbers (`android.versionCode` and `ios.buildNumber`) instead of relying on CI to commit version bumps back to Git.

For Android submissions, Google Play requires the app to be created in Play Console and the first upload may need to be manual before API submission works. For iOS submissions, the App Store Connect app record must exist first.

The brand-specific submit profiles in `eas.json` target Android's `internal`
track by default. Before submitting a new label, create its Google Play and App
Store Connect records and complete the first interactive credential setup. For
fully non-interactive iOS submission, add that label's App Store Connect app id
as `ascAppId` in its submit profile after the app record exists.

## Apple Machine Setup

Use a Mac with current Xcode installed and the Apple ID that has access to the Apple Developer team and App Store Connect app.

Recommended first-time setup:

```sh
xcode-select --install
git clone https://github.com/jkinsey-deepelevations/brightshore-pl-apps.git
cd brightshore-pl-apps
npm ci
cd ios
pod install
open BrightShoreMortgage.xcworkspace
```

In Xcode:

- Open `ios/BrightShoreMortgage.xcworkspace`, not the `.xcodeproj`.
- Select the `BrightShoreMortgage` scheme.
- Select the app target, then Signing & Capabilities.
- Set the Apple development team.
- Keep the bundle identifier as `com.brightshoremortgage.app`.
- Enable automatic signing unless the Apple team requires manual provisioning.
- Build once to a simulator, then archive using `Any iOS Device (arm64)`.

If Xcode cannot find Node, install Node with Homebrew and reopen Xcode:

```sh
brew install node
```

## App Store Connect

Create or confirm the BrightShore app record in App Store Connect:

- Name: `BrightShore Mortgage`
- Bundle ID: `com.brightshoremortgage.app`
- SKU: a stable internal value, for example `brightshore-mortgage-ios`
- Version: `1.0`

Before submitting for review:

- Add screenshots for iPhone and iPad if iPad support stays enabled.
- Add support URL and privacy policy URL.
- Complete App Privacy details.
- Add review notes explaining this is the official BrightShore Mortgage servicing app.
- Confirm whether the app actually tracks users or uses advertising ID. If not, remove the tracking prompt and Android advertising ID permission before final submission.

## Xcode Cloud

Xcode Cloud requires a remote Git repository and is configured from Xcode or App Store Connect on a Mac.

This repo has `ci_scripts/ci_post_clone.sh`, which Xcode Cloud runs after cloning. It installs JavaScript dependencies with `npm ci` and installs CocoaPods with `pod install`.

Suggested Xcode Cloud workflow:

- Repository: `jkinsey-deepelevations/brightshore-pl-apps`
- Branch: `main`
- Scheme: `BrightShoreMortgage`
- Action: Archive
- Destination: Generic iOS Device
- Distribution: TestFlight first, then App Store after review metadata is complete

The tiny `ios/ci_scripts/ci_post_clone.sh` wrapper is included for workflows that use the `ios` directory as the Xcode workspace root.

## Google Play

Create or confirm the BrightShore app in Google Play Console:

- App name: `BrightShore Mortgage`
- Package: `com.brightshoremortgage.app`
- First release artifact: Android App Bundle from EAS production build

Before submitting:

- Complete store listing assets and descriptions.
- Complete the Data Safety form.
- Add privacy policy URL.
- Confirm app access instructions if any feature requires login.

## Release Flow

For normal code changes:

```sh
npm ci
npx tsc --noEmit
npx expo config --json
git push
```

Pushing to `main` triggers the EAS build workflow when `EXPO_TOKEN` is configured. Manual release builds can be started from GitHub Actions > EAS Release.

Use the manual `ios` or `all` platform options only after the first interactive iOS EAS build has completed successfully. Use the manual `submit` option only after App Store Connect, Google Play, EAS credentials, and store submission credentials are ready. For iOS CI submission, set `submit.production.ios.ascAppId` in `eas.json` once App Store Connect shows the app id.

## App Store Screenshots

There are two different screenshot workflows:

- `npm run screenshots:app-store` creates synthetic BrightShore previews. It
  captures website content and composites app chrome around it. These are useful
  for layout review, but they are not evidence of the installed iOS or Android
  application running.
- `npm run screenshots:capture` captures the real installed application from an
  Android emulator or iOS Simulator while it is displaying the live servicing
  sites. Use this workflow for the final BrightShore, Essex, and Cornerstone
  store screenshot sets.

### Current screenshot version baselines

| Brand | iOS | Android |
| --- | --- | --- |
| BrightShore | Version `1.0`, build `8` | Version `1.0`, version code `13` |
| Essex | Version `1.1.1`, build `37` | Version `1.1.1`, version code `4` |
| Cornerstone | Version `1.0.0`; corrected simulator build `3` | Version `1.0.0`; corrected screenshot APK and Play AAB code `3` |

Pass the build number or version code of the app that is actually installed to
`screenshots:capture`. If a newer artifact is installed, replace the baseline
number in the examples below with that artifact's number.

### Installable per-brand screenshot builds

The screenshot EAS profiles produce an Android APK or an iOS Simulator build.
They select the same brand configuration as production but are intended only
for installation and screenshot capture; do not submit them to a store.

```sh
# BrightShore
npx eas-cli@latest build --platform android --profile brightshore-screenshot
npx eas-cli@latest build --platform ios --profile brightshore-screenshot

# Essex
npx eas-cli@latest build --platform android --profile essex-screenshot
npx eas-cli@latest build --platform ios --profile essex-screenshot

# Cornerstone First Mortgage
npx eas-cli@latest build --platform android --profile cornerstone-screenshot
npx eas-cli@latest build --platform ios --profile cornerstone-screenshot
```

Android capture can be performed on Windows, macOS, or Linux. iOS Simulator
capture requires a Mac with Xcode. The EAS iOS Simulator builds can be started
from any machine, then downloaded and moved to the Mac as needed.

### Android installed-app capture

Create or select an Android Virtual Device, close any running instance, and
launch it with a native `1080x1920` framebuffer. Do not use a live `wm size`
override because it can desynchronize automation coordinates from screenshots.

```sh
emulator -avd <AVD_NAME> -skin 1080x1920 -no-snapshot-load
adb devices
adb shell wm size
```

`adb shell wm size` must report `Physical size: 1080x1920`. Download the APK
from its EAS build page and install it, replacing the example path:

```sh
adb install -r path/to/brand-screenshot.apk
```

Keep exactly one Android device connected, or pass its `adb` serial with
`--device`. The capture script also requires `ffmpeg` on `PATH`; it fixes the
status bar, density, orientation, theme, and animation settings before it
launches the installed app and walks through the capture sequence.
It also collapses the site's timed chat nudge and rejects frames whose native
header/footer controls are not present in the captured pixels.

```sh
npm run screenshots:capture -- --platform android --brand brightshore --build 13
npm run screenshots:capture -- --platform android --brand essex --build 4
npm run screenshots:capture -- --platform android --brand cornerstone --build 3

# Example when more than one device is attached
npm run screenshots:capture -- --platform android --brand brightshore --build 13 --device emulator-5554
```

### iOS installed-app capture on a Mac

Download and extract the `.app` from the matching EAS iOS Simulator build. Use
Xcode's Simulator app or `simctl` to boot one target device, install the app, and
then run the capture. Shut down other simulators first, or use the target UDID
instead of `booted` for `--device`.

```sh
open -a Simulator
xcrun simctl shutdown all
xcrun simctl boot "iPhone 16 Pro Max"
xcrun simctl bootstatus booted -b
xcrun simctl install booted /path/to/Brand.app

npm run screenshots:capture -- --platform ios --brand brightshore --build 8 --device booted --device-class iphone-6.9
npm run screenshots:capture -- --platform ios --brand essex --build 37 --device booted --device-class iphone-6.9
npm run screenshots:capture -- --platform ios --brand cornerstone --build 3 --device booted --device-class iphone-6.9
```

The `iphone-6.9` validation accepts native screenshots at `1260x2736`,
`1290x2796`, or `1320x2868`. For the iPad set, boot a compatible iPad Pro
Simulator, reinstall the same brand's `.app`, and use `ipad-13`:

```sh
xcrun simctl shutdown all
xcrun simctl boot "iPad Pro 13-inch (M4)"
xcrun simctl bootstatus booted -b
xcrun simctl install booted /path/to/Brand.app

npm run screenshots:capture -- --platform ios --brand brightshore --build 8 --device booted --device-class ipad-13
```

The `ipad-13` validation accepts `2048x2732` or `2064x2752`. Repeat the iPad
capture with `--brand essex --build 37` and `--brand cornerstone --build 3`
after installing each matching app. The iOS workflow captures the home screen,
then prompts you to navigate the installed app before each remaining image.

### Screenshot outputs and credentials

Installed-app sets and their dimension/hash manifests are written beneath:

```text
dist/store-screenshots/<brand>/<platform>/<version-and-build>/en-US/<device-class>/
```

Synthetic BrightShore previews are written to
`dist/app-store-screenshots/`. The entire `dist/` directory is ignored by both
Git and EAS, so copy approved deliverables somewhere durable before cleaning the
workspace and upload them to the stores explicitly.

The synthetic BrightShore generator can use local eStatus credentials from the
ignored `.env` file:

```sh
BRIGHTSHORE_ESTATUS_USERNAME=...
BRIGHTSHORE_ESTATUS_PASSWORD=...
```

Its default run captures public live-site pages. Use
`BRIGHTSHORE_SCREENSHOT_MODE=auth` to regenerate only authenticated eStatus
previews, or `BRIGHTSHORE_SCREENSHOT_MODE=all` to regenerate both public and
authenticated previews. Process environment variables override `.env` values.
Do not commit eStatus credentials; `.env` is ignored by Git and EAS.
