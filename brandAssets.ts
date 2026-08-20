import type { ImageSourcePropType } from "react-native";
import { getBrandKey } from "./brands";
import type { BrandKey } from "./brands/types";

const assets: Record<BrandKey, { drawerLogo: ImageSourcePropType }> = {
  brightshore: {
    drawerLogo: require("./assets/brands/brightshore/logo-white.png"),
  },
  essex: {
    drawerLogo: require("./assets/brands/essex/icon.png"),
  },
  cornerstone: {
    drawerLogo: require("./assets/brands/cornerstone/logo.png"),
  },
};

const selectedBrand = getBrandKey(process.env.EXPO_PUBLIC_APP_BRAND);

export default assets[selectedBrand];
