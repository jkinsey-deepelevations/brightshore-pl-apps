const baseUrl = "https://essexmortgage.com";
const eStatusHomeUrl = "https://essexmortgage.estatusconnect.com";

/** @type {import("./types").BrandConfig} */
const essex = {
  key: "essex",
  appName: "Essex Servicing",
  slug: "essex-servicing-app",
  version: "1.1.1",
  iosBundleIdentifier: "com.essexservicing.app",
  androidPackage: "com.essexservicing.app",
  easProjectId: "ef50d6ef-2f92-4922-b98e-679f61df082c",
  iosBuildNumber: "37",
  androidVersionCode: 4,
  assets: {
    icon: "./assets/brands/essex/icon.png",
    adaptiveIcon: "./assets/brands/essex/adaptive-icon.png",
    splash: "./assets/brands/essex/icon.png",
    favicon: "./assets/brands/essex/favicon.png",
  },
  baseUrl,
  initialUrl: baseUrl,
  paymentUrl: `${baseUrl}/myaccount#quick-actions`,
  paymentTabLabel: "Pay as Guest",
  loginUrl: eStatusHomeUrl,
  loginStrategy: "direct",
  manageUrl: baseUrl,
  manageLoginUrl: eStatusHomeUrl,
  payAsGuestUrl: `${baseUrl}/myaccount#quick-actions`,
  publicHostnames: ["essexmortgage.com", "www.essexmortgage.com"],
  aboutSlug: "the-essex-story",
  aboutUrl: `${baseUrl}/the-essex-story`,
  hardshipUrl: `${baseUrl}/mortgage-assistance`,
  refinanceUrl: `${baseUrl}/refinance`,
  chatUrl:
    "https://app.five9.com/clients/consoles/ChatConsole/index.html?title=Essex%20Mortgage%20Customer%20CARE&tenant=Essex%20Mortgage&profiles=General%20Loan%20Information%2CEscrow%20Questions%2CPayment%20Questions%2CMortgage%20Assistance%2CWebsite%20Assistance&showProfiles=true&autostart=true&profileLabel=Reason%20for%20Contacting%20(select%20below)&theme=https%3A%2F%2Fzachtapia.github.io%2Ffiles%2Fchat_branding.css&logo=https%3A%2F%2Fzachtapia.github.io%2Ffiles%2FEssex_Color_Rev_Stacked.png&surveyOptions=%7B%22showComment%22%3Afalse%2C%22requireComment%22%3Afalse%7D&fields=%7B%22name%22%3A%7B%22value%22%3A%22%22%2C%22show%22%3Afalse%2C%22label%22%3A%22Name%22%7D%2C%22email%22%3A%7B%22value%22%3A%22%22%2C%22show%22%3Atrue%2C%22label%22%3A%22Email%22%7D%2C%22Phone%20Number%22%3A%7B%22value%22%3A%22%22%2C%22show%22%3Afalse%2C%22label%22%3A%22Best%20Contact%20Number%22%2C%22required%22%3Afalse%7D%2C%22UserLocale%22%3A%7B%22value%22%3A%22en%22%2C%22show%22%3Afalse%7D%7D&playSoundOnMessage=true&allowCustomerToControlSoundPlay=false&showEmailButton=false&hideDuringAfterHours=false&useBusinessHours=true&showPrintButton=true&allowUsabilityMenu=true&enableCallback=true&callbackList=Chat%20Callback&callbackConfirmation=We%20will%20call%20you%20as%20soon%20as%20we%20can%20at%20%5BPHONE%5D&allowRequestLiveAgent=true&namespace=essexmortgage.com",
  faqUrl: `${baseUrl}/servicing-learning-center`,
  eStatusLoginUrl: `${eStatusHomeUrl}/User/Login`,
  eStatusHomeUrl,
  trackingDomains: [
    "ad.doubleclick.net",
    "googleads.g.doubleclick.net",
    "www.google.com",
    "www.googletagmanager.com",
  ],
  primary: "#3230be",
  secondary: "",
  textColor: "#fff",
  textColorSecondary: "#333",
  iconColor: "#fff",
  borderColor: "#ccc",
  phone: "8888920881",
  email: "CustomerCARE@EssexMortgage.com",
};

module.exports = essex;
