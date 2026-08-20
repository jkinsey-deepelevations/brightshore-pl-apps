const brightshore = require("./brightshore");
const essex = require("./essex");
const cornerstone = require("./cornerstone");

const DEFAULT_BRAND = "brightshore";

/** @type {Record<import("./types").BrandKey, import("./types").BrandConfig>} */
const brands = {
  brightshore,
  essex,
  cornerstone,
};

/** @param {string | undefined} value */
const getBrandKey = (value) => {
  const key = value?.trim().toLowerCase() || DEFAULT_BRAND;

  if (key in brands) {
    return /** @type {import("./types").BrandKey} */ (key);
  }

  throw new Error(
    `Unknown APP_BRAND "${value}". Expected one of: ${Object.keys(brands).join(", ")}.`
  );
};

/** @param {string | undefined} value */
const getBrandConfig = (value) => brands[getBrandKey(value)];

module.exports = {
  DEFAULT_BRAND,
  brands,
  getBrandKey,
  getBrandConfig,
};
