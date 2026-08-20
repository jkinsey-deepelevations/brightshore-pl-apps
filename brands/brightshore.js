const baseUrl = "https://brightshoremortgage.com";
const manageUrl = `${baseUrl}/manage`;

/** @type {import("./types").BrandConfig} */
const brightshore = {
  key: "brightshore",
  appName: "BrightShore Mortgage",
  slug: "brightshore-servicing",
  version: "1.0",
  iosBundleIdentifier: "com.brightshoremortgage.app",
  androidPackage: "com.brightshoremortgage.app",
  easProjectId: "5e9d4eee-d490-453e-b619-17643137965f",
  // Current live store baselines. EAS remote versioning owns production
  // increments, while these values keep local/prebuild metadata accurate.
  iosBuildNumber: "8",
  androidVersionCode: 13,
  assets: {
    icon: "./assets/brands/brightshore/icon.png",
    adaptiveIcon: "./assets/brands/brightshore/adaptive-icon.png",
    splash: "./assets/brands/brightshore/splash-icon.png",
    favicon: "./assets/brands/brightshore/favicon.png",
  },
  baseUrl,
  initialUrl: manageUrl,
  paymentUrl: `${manageUrl}#pay-as-guest`,
  loginUrl: `${manageUrl}?portal=account`,
  loginStrategy: "embedded-public-portal",
  manageUrl,
  manageLoginUrl: `${manageUrl}?portal=account`,
  payAsGuestUrl: `${manageUrl}#pay-as-guest`,
  publicHostnames: ["brightshoremortgage.com", "www.brightshoremortgage.com"],
  aboutSlug: "behind-every-experience",
  aboutUrl: `${baseUrl}/behind-every-experience`,
  hardshipUrl: `${baseUrl}/mortgage-assistance`,
  refinanceUrl: `${baseUrl}/blog`,
  drawerLabels: {
    refinance: "Learning Center",
  },
  chatUrl: `${baseUrl}/contact`,
  faqUrl: `${baseUrl}/faq`,
  eStatusLoginUrl:
    "https://brightshoremortgage.estatusconnect.com/User/Login",
  eStatusHomeUrl: "https://brightshoremortgage.estatusconnect.com",
  trackingDomains: [
    "ad.doubleclick.net",
    "googleads.g.doubleclick.net",
    "www.google.com",
    "www.googletagmanager.com",
  ],
  primary: "#20275a",
  secondary: "#9c6e2e",
  textColor: "#fff",
  textColorSecondary: "#333",
  iconColor: "#fff",
  borderColor: "#ccc",
  phone: "8445669556",
  email: "CustomerCare@servicingbranch.com",
};

module.exports = brightshore;
