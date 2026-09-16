const baseUrl = "https://cfmtg.accountaccessnow.com";
const manageUrl = `${baseUrl}/manage`;
const eStatusHomeUrl = "https://servicingbranch.estatusconnect.com";

/** @type {import("./types").BrandConfig} */
const cornerstone = {
  key: "cornerstone",
  appName: "Cornerstone First Mortgage",
  slug: "cornerstone-servicing-app",
  version: "1.0.0",
  iosBundleIdentifier: "com.cfmtg.servicing",
  androidPackage: "com.cfmtg.servicing",
  easProjectId: "7c5be7c0-3264-4c65-8033-7decb85945fd",
  // Source fallbacks mirror the corrected first-release artifacts. EAS remote
  // versioning owns subsequent production increments.
  iosBuildNumber: "3",
  androidVersionCode: 3,
  assets: {
    icon: "./assets/brands/cornerstone/icon.png",
    adaptiveIcon: "./assets/brands/cornerstone/adaptive-icon.png",
    splash: "./assets/brands/cornerstone/splash.png",
    favicon: "./assets/brands/cornerstone/favicon.png",
  },
  baseUrl,
  initialUrl: manageUrl,
  paymentUrl: `${manageUrl}#pay-as-guest`,
  loginUrl: `${manageUrl}?portal=account`,
  loginStrategy: "embedded-public-portal",
  // iOS must authenticate in the main WebView rather than a cross-site iframe.
  iosLogin: {
    loginUrl: `${eStatusHomeUrl}/User/Login`,
    loginStrategy: "direct",
    manageLoginUrl: `${eStatusHomeUrl}/User/Login`,
  },
  manageUrl,
  manageLoginUrl: `${manageUrl}?portal=account`,
  payAsGuestUrl: `${manageUrl}#pay-as-guest`,
  publicHostnames: ["cfmtg.accountaccessnow.com"],
  aboutSlug: "transferred",
  aboutUrl: `${baseUrl}/transferred`,
  hardshipUrl: `${baseUrl}/mortgage-assistance`,
  refinanceUrl: `${baseUrl}/blog`,
  chatUrl: `${baseUrl}/contact`,
  faqUrl: `${baseUrl}/faq`,
  eStatusLoginUrl: `${eStatusHomeUrl}/User/Login`,
  eStatusHomeUrl,
  trackingDomains: [
    "ad.doubleclick.net",
    "googleads.g.doubleclick.net",
    "www.google.com",
    "www.googletagmanager.com",
  ],
  drawerLabels: {
    home: "Manage Your Mortgage",
    about: "Transferred to Cornerstone",
    hardship: "Mortgage Assistance",
    contact: "Contact Us",
    refinance: "Learning Center",
  },
  primary: "#002E5E",
  secondary: "#FF6B00",
  textColor: "#fff",
  textColorSecondary: "#333",
  iconColor: "#fff",
  borderColor: "#ccc",
  phone: "8888920886",
  email: "CustomerCare@ServicingBranch.com",
};

module.exports = cornerstone;
