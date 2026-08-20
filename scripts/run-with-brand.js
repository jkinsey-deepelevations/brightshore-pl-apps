const { spawnSync } = require("node:child_process");

const [, , requestedBrand, command, ...args] = process.argv;
const supportedBrands = new Set(["brightshore", "essex", "cornerstone"]);

if (!supportedBrands.has(requestedBrand) || !command) {
  console.error(
    "Usage: node scripts/run-with-brand.js <brightshore|essex|cornerstone> <command> [...args]"
  );
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    APP_BRAND: requestedBrand,
    EXPO_PUBLIC_APP_BRAND: requestedBrand,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
