# BrightShore Mortgage Deployment

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
- `.github/workflows/eas-release.yml` triggers production EAS builds on pushes to `main` and supports a manual `workflow_dispatch` run with an optional store submission.

Before the release workflow can run, add this repository secret in GitHub:

- `EXPO_TOKEN`: an Expo access token for the Expo account that owns the app.

This repository is already linked to the existing Expo/EAS project through `expo.extra.eas.projectId` in `app.json`. Run one interactive EAS production build per platform before relying on CI. This lets EAS confirm the project and collect/create credentials:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

For Android submissions, Google Play requires the app to be created in Play Console and the first upload may need to be manual before API submission works. For iOS submissions, the App Store Connect app record must exist first.

## Xcode Cloud

Xcode Cloud requires a remote Git repository and is configured from Xcode or App Store Connect on a Mac. This repo has `ci_scripts/ci_post_clone.sh`, which Xcode Cloud runs after cloning. It installs Node dependencies with `npm ci` and installs CocoaPods with `pod install`.

On the Mac:

```sh
git clone https://github.com/jkinsey-deepelevations/brightshore-mortgage-app.git
cd brightshore-mortgage-app
npm ci
cd ios
pod install
open BrightShoreMortgage.xcworkspace
```

In Xcode, select the `BrightShoreMortgage` scheme, assign the Apple development team/signing settings, confirm the bundle identifier is `com.brightshoremortgage.app`, and create the Xcode Cloud workflow against the `main` branch. Use an Archive action for TestFlight/App Store builds.

## Store Checklist

- Create the BrightShore app in App Store Connect with bundle ID `com.brightshoremortgage.app`.
- Create the BrightShore app in Google Play Console with package `com.brightshoremortgage.app`.
- Add screenshots, descriptions, support URL, privacy policy URL, and review notes for each store.
- Complete Apple privacy nutrition labels and Google Play Data Safety forms.
- Confirm whether tracking/advertising ID is actually used. If not, remove the tracking transparency prompt and Android advertising ID permission before final submission.
