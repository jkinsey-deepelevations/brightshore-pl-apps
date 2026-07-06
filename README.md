# BrightShore Mortgage

BrightShore Mortgage is a separate app from Essex Mortgage and must keep its own store identity.

- iOS bundle identifier: `com.brightshoremortgage.app`
- Android package: `com.brightshoremortgage.app`
- Expo slug: `brightshore-servicing`
- Expo/EAS project ID: `5e9d4eee-d490-453e-b619-17643137965f`
- App version: `1.0`
- iOS build number: `1`
- Android version code: `1`

## GitHub Actions and EAS

The repository includes two GitHub workflows:

- `.github/workflows/ci.yml` runs dependency install, TypeScript, and Expo config validation on pull requests and pushes to `main`.
- `.github/workflows/eas-release.yml` triggers production EAS builds on pushes to `main` and supports a manual `workflow_dispatch` run with optional store submission.

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

This repository is already linked to the existing Expo/EAS project through `expo.extra.eas.projectId` in `app.json`.

Run one interactive EAS production build per platform before relying on CI. This lets EAS confirm the project and collect/create credentials:

```sh
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

For Android submissions, Google Play requires the app to be created in Play Console and the first upload may need to be manual before API submission works. For iOS submissions, the App Store Connect app record must exist first.

## Apple Machine Setup

Use a Mac with current Xcode installed and the Apple ID that has access to the Apple Developer team and App Store Connect app.

Recommended first-time setup:

```sh
xcode-select --install
git clone https://github.com/jkinsey-deepelevations/brightshore-mortgage-app.git
cd brightshore-mortgage-app
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

- Repository: `jkinsey-deepelevations/brightshore-mortgage-app`
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

Use the manual `submit` option only after App Store Connect, Google Play, EAS credentials, and store submission credentials are ready.
