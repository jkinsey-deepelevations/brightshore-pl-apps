import type { ConfigContext, ExpoConfig } from "expo/config";
import { getBrandConfig } from "./brands/index.js";

export default ({ config }: ConfigContext): ExpoConfig => {
  const brand = getBrandConfig(
    process.env.APP_BRAND ?? process.env.EXPO_PUBLIC_APP_BRAND
  );
  const trackingPermission = `This allows ${brand.appName} and its website partners to use cookies and device identifiers for tracking across apps and websites.`;

  return {
    ...config,
    name: brand.appName,
    slug: brand.slug,
    version: brand.version,
    icon: brand.assets.icon,
    // All private labels share the native runtime used by the current
    // BrightShore codebase. Keep this centralized rather than brand-specific.
    newArchEnabled: false,
    splash: {
      image: brand.assets.splash,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      ...config.ios,
      bundleIdentifier: brand.iosBundleIdentifier,
      ...(brand.iosBuildNumber
        ? { buildNumber: brand.iosBuildNumber }
        : {}),
      infoPlist: {
        ...config.ios?.infoPlist,
        ITSAppUsesNonExemptEncryption: false,
        NSUserTrackingUsageDescription: trackingPermission,
      },
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["0A2A.1", "3B52.1", "C617.1"],
          },
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategoryDiskSpace",
            NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
          },
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
          },
        ],
        NSPrivacyCollectedDataTypes: [],
        NSPrivacyTracking: true,
        NSPrivacyTrackingDomains: brand.trackingDomains,
      },
    },
    android: {
      ...config.android,
      package: brand.androidPackage,
      ...(brand.androidVersionCode
        ? { versionCode: brand.androidVersionCode }
        : {}),
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
      adaptiveIcon: {
        foregroundImage: brand.assets.adaptiveIcon,
        backgroundColor: "#ffffff",
      },
    },
    web: {
      ...config.web,
      favicon: brand.assets.favicon,
    },
    plugins: [
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission: trackingPermission,
        },
      ],
    ],
    extra: {
      ...config.extra,
      appBrand: brand.key,
      eas: {
        ...config.extra?.eas,
        projectId: brand.easProjectId,
      },
    },
  };
};
