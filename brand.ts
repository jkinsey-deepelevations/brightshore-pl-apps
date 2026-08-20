import { getBrandConfig } from "./brands";

// EXPO_PUBLIC_APP_BRAND is embedded in the JavaScript bundle at build time.
// BrightShore remains the safe local-development default.
export default getBrandConfig(process.env.EXPO_PUBLIC_APP_BRAND);
