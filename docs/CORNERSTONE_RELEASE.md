# Cornerstone store release status

Status date: September 9, 2026

## iOS direct eStatus update

- Version `1.0.0`, iOS build `4`; bundle ID `com.cfmtg.servicing`.
- The iOS Login tab and public website account links now open
  `https://servicingbranch.estatusconnect.com/User/Login` in the main WebView.
- Android retains the embedded `/manage?portal=account` account portal.
- Home and Pay as Guest retain their existing public website destinations.
- Validation: TypeScript, resolved Cornerstone Expo identity, and Playwright
  checks of the live website using the app's injected script. The iOS account
  click navigated the main page to eStatus; Android opened the account iframe.
  The test intercepted the destination response; authenticated borrower login
  and document downloads still require an iPhone check.
- [Signed iOS build 4](https://expo.dev/accounts/jkinsey-deepelevations/projects/cornerstone-servicing-app/builds/867077b9-c7c6-4e17-8395-5ba9b6065998)
- [App Store Connect submission](https://expo.dev/accounts/jkinsey-deepelevations/projects/cornerstone-servicing-app/submissions/ab602de5-b8ca-40d7-b524-af77049182cb)
- App Store Connect app ID: `6803138269`.
- Signed build finished successfully. Automatic App Store Connect submission
  is `IN_QUEUE` with no reported error at the last check. Upload completion
  and Apple processing are not yet confirmed; use the submission link above.
- Local signed artifact: `dist/eas-artifacts/cornerstone-ios-app-store-4.ipa`.
  Its embedded Info.plist confirms the Cornerstone display name, bundle ID,
  version `1.0.0`, and build `4`.
- IPA SHA-256: `9466d165172c21051384410fbbb21a90854e5365a38464f990e0c3b846e3a6d2`.

The August 19 artifacts and original store handoff notes below are retained
for reference. Android version code `3` remains the existing Android artifact.

## Identity

- Expo project: `@jkinsey-deepelevations/cornerstone-servicing-app`
- Expo project ID: `7c5be7c0-3264-4c65-8033-7decb85945fd`
- Store/app name: `Cornerstone First Mortgage`
- Version: `1.0.0`
- Android package: `com.cfmtg.servicing`
- iOS bundle identifier: `com.cfmtg.servicing`
- Servicing portal: `https://cfmtg.accountaccessnow.com/manage`

## EAS artifacts

These Expo build pages are permanent references. Download URLs appear after a
build finishes and may expire, so always return to the build page rather than
recording an artifact URL here.

- [Cornerstone corrected Android Play AAB, version code 3](https://expo.dev/accounts/jkinsey-deepelevations/projects/cornerstone-servicing-app/builds/346cab89-f00e-493d-896e-95799937bdba)
- [Cornerstone corrected Android screenshot APK, version code 3](https://expo.dev/accounts/jkinsey-deepelevations/projects/cornerstone-servicing-app/builds/03164499-050e-4e18-b819-f76eadc0b06b)
- [Cornerstone corrected iOS Simulator build 3](https://expo.dev/accounts/jkinsey-deepelevations/projects/cornerstone-servicing-app/builds/964cc6ce-5afa-4bab-b680-755c0d1eebc2)
- [Cornerstone corrected signed iOS App Store build 3](https://expo.dev/accounts/jkinsey-deepelevations/projects/cornerstone-servicing-app/builds/6d9e361e-0262-42f7-b31b-ae95aff49c16)
- [BrightShore corrected iOS Simulator build 8](https://expo.dev/accounts/jkinsey-deepelevations/projects/brightshore-servicing/builds/2f13d99c-ac96-46cb-a095-11c2b03caa1e)
- [Essex corrected iOS Simulator build 37](https://expo.dev/accounts/jkinsey-deepelevations/projects/essex-servicing-app/builds/8bf7b0f5-eaaa-4ee8-975a-59c09ba6102b)

Earlier Cornerstone code/build `1` and `2` artifacts are superseded and must not
be uploaded to either store. Build `3` contains the shared Pay as Guest routing
fix for both `#pay-as-guest` and `#quick-actions` servicing sites.

The Cornerstone Android signing keystore and iOS App Store distribution
certificate/provisioning profile are stored in the Cornerstone Expo project.
The Apple Developer App ID is registered to team `45P8MZGRUT` for bundle ID
`com.cfmtg.servicing`.

Downloaded corrected artifact:

- `dist/eas-artifacts/cornerstone-android-play-3.aab`
  - SHA-256: `78A6D9606095F457520A6304DECDE19DA2580501D6BA902E762423522A1363DF`
  - Size: 31,212,794 bytes
- `dist/eas-artifacts/cornerstone-android-screenshot-3.apk`
  - SHA-256: `9280CD1824688B807E0EE1802B904B55DFE2F2E57F90836B883A99D268A2A310`
  - Size: 62,285,137 bytes
- `dist/eas-artifacts/cornerstone-ios-app-store-3.ipa`
  - SHA-256: `44200FCFD95704960BF04EC0E3AC08C228753FCD823FD9F913B146F3FB91D43D`
  - Size: 13,860,889 bytes
- `dist/eas-artifacts/cornerstone-ios-simulator-3-corrected.tar.gz`
  - SHA-256: `87D8D08EF850A86D2A76F3FB416641E15CE253702DCD2BF15EDD002E3345BE96`
  - Size: 15,359,620 bytes
- `dist/eas-artifacts/brightshore-ios-simulator-8-corrected.tar.gz`
  - SHA-256: `584D3A6897EBA785E6323A6DF46097EEAF2AB28DEDF8D793EF6B86421C3404C6`
  - Size: 14,372,406 bytes
- `dist/eas-artifacts/essex-ios-simulator-37-corrected.tar.gz`
  - SHA-256: `E477F0F55E54EE6F945CE6BAFF08C20A6172AA9FCB608C12124252B2DB34597D`
  - Size: 14,225,436 bytes

## Google Play Console handoff

Create the app in Play Console with these fixed values:

- App name: `Cornerstone First Mortgage`
- Default language: English (United States)
- App type: App
- Package name supplied by the AAB: `com.cfmtg.servicing`
- Initial release track: Internal testing
- Release artifact: the corrected version-code-3 AAB linked above

Before rollout, the store owner must supply or approve the privacy-policy URL,
support contact, short and full descriptions, Data safety answers, content
rating, target audience, countries/regions, pricing, and required declarations.
Use screenshots captured from the finished brand-specific APK rather than the
older debug-container captures.

The live Cornerstone servicing privacy policy is
`https://cfmtg.accountaccessnow.com/privacy` (HTTP 200, title "Privacy Policy |
Cornerstone First Mortgage" on August 19, 2026). The final package-authentic
Android screenshot set and hash manifest are in:

`dist/store-screenshots/cornerstone/android/1.0.0-version-code-3/en-US/phone/`

## Apple and iOS screenshot handoff

The Simulator builds do not require Apple signing. On the Mac, download and
extract each `.app`, install it into the matching iPhone and iPad simulators,
and run the installed-app capture commands in the repository README.

Capture both device classes for every brand because tablet support is enabled:

- iPhone 16 Pro Max / 6.9-inch: `1320x2868` JPEG preferred
- iPad Pro 13-inch: `2064x2752` JPEG preferred

For the Cornerstone App Store record, use bundle ID `com.cfmtg.servicing` and
version `1.0.0`. After App Store Connect creates the record, add its numeric app
ID as `submit.cornerstone-production.ios.ascAppId` in `eas.json`.
