export type BrandKey = "brightshore" | "essex" | "cornerstone";

export type LoginStrategy = "embedded-public-portal" | "direct";

export type BrandConfig = {
  key: BrandKey;
  appName: string;
  slug: string;
  version: string;
  iosBundleIdentifier: string;
  androidPackage: string;
  easProjectId: string;
  iosBuildNumber?: string;
  androidVersionCode?: number;
  assets: {
    icon: string;
    adaptiveIcon: string;
    splash: string;
    favicon: string;
  };
  baseUrl: string;
  initialUrl: string;
  paymentUrl: string;
  paymentTabLabel?: string;
  loginUrl: string;
  loginStrategy: LoginStrategy;
  manageUrl: string;
  manageLoginUrl: string;
  payAsGuestUrl: string;
  publicHostnames: string[];
  aboutSlug: string;
  aboutUrl: string;
  hardshipUrl: string;
  refinanceUrl: string;
  chatUrl: string;
  faqUrl: string;
  eStatusLoginUrl: string;
  eStatusHomeUrl: string;
  trackingDomains: string[];
  drawerLabels?: {
    home?: string;
    about?: string;
    hardship?: string;
    contact?: string;
    refinance?: string;
  };
  primary: string;
  secondary: string;
  textColor: string;
  textColorSecondary: string;
  iconColor: string;
  borderColor: string;
  phone: string;
  email: string;
};
