const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, "dist", "app-store-screenshots");

function resetOutputRoot() {
  const resolvedOutRoot = path.resolve(outRoot);
  const resolvedDistRoot = path.resolve(root, "dist");
  if (!resolvedOutRoot.startsWith(`${resolvedDistRoot}${path.sep}`)) {
    throw new Error(`Refusing to clear unexpected screenshot path: ${resolvedOutRoot}`);
  }

  fs.rmSync(resolvedOutRoot, { recursive: true, force: true });
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    let value = rawValue.trim();
    const quote = value[0];
    if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === "\"") {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, "\"")
          .replace(/\\\\/g, "\\");
      }
    } else {
      value = value.replace(/\s+#.*$/, "");
    }

    process.env[key] = value;
  }
}

loadDotEnv(path.join(root, ".env"));

const eStatusCredentials = {
  username:
    process.env.BRIGHTSHORE_ESTATUS_USERNAME || process.env.ESTATUS_USERNAME || "",
  password:
    process.env.BRIGHTSHORE_ESTATUS_PASSWORD || process.env.ESTATUS_PASSWORD || "",
};
const hasEStatusCredentials = Boolean(
  eStatusCredentials.username && eStatusCredentials.password
);
const screenshotMode = process.env.BRIGHTSHORE_SCREENSHOT_MODE || "public";

const brand = {
  baseUrl: "https://brightshoremortgage.com",
  aboutSlug: "behind-every-experience",
  chatUrl: "https://brightshoremortgage.com/contact",
  faqUrl: "https://brightshoremortgage.com/faq",
  eStatusHomeUrl: "https://brightshoremortgage.estatusconnect.com",
  primary: "#20275a",
};

const devices = [
  {
    name: "iphone-6.5",
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 3,
    expected: { width: 1242, height: 2688 },
    isMobile: true,
  },
  {
    name: "iphone-6.7",
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    expected: { width: 1284, height: 2778 },
    isMobile: true,
  },
  {
    name: "ipad-12.9",
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    expected: { width: 2048, height: 2732 },
    isMobile: false,
  },
];

const publicPages = [
  {
    name: "01-home",
    title: "Home",
    tabTitle: "Home",
    url: brand.baseUrl,
  },
  {
    name: "02-payment",
    title: "Payment",
    tabTitle: "Payment",
    url: `${brand.baseUrl}/manage#QuickAction`,
  },
  {
    name: "03-login",
    title: "Login",
    tabTitle: "Login",
    url: brand.eStatusHomeUrl,
  },
  {
    name: "04-faq",
    title: "FAQ",
    tabTitle: "FAQ",
    url: brand.faqUrl,
  },
  {
    name: "05-about",
    title: "About",
    url: `${brand.baseUrl}/${brand.aboutSlug}`,
  },
  {
    name: "06-hardship",
    title: "Hardship",
    url: `${brand.baseUrl}/mortgage-assistance`,
  },
  {
    name: "07-contact",
    title: "Contact",
    url: brand.chatUrl,
  },
  {
    name: "08-refinance",
    title: "Refinance",
    url: `${brand.baseUrl}/refinancing-your-loan`,
  },
  {
    name: "09-menu",
    title: "Menu",
    tabTitle: "Home",
    url: brand.baseUrl,
    drawer: true,
  },
];

const authenticatedPages = [
  {
    name: "10-dashboard",
    title: "Dashboard",
    tabTitle: "Login",
    url: brand.eStatusHomeUrl,
    requiresAuth: true,
  },
  {
    name: "11-payment-history",
    title: "Payment",
    tabTitle: "Payment",
    url: `${brand.eStatusHomeUrl}/History/Payment`,
    requiresAuth: true,
  },
  {
    name: "12-documents",
    title: "Documents",
    tabTitle: "Login",
    url: `${brand.eStatusHomeUrl}/Documents`,
    requiresAuth: true,
  },
  {
    name: "13-account-info",
    title: "Account",
    tabTitle: "Login",
    url: `${brand.eStatusHomeUrl}/AccountInformation`,
    requiresAuth: true,
  },
];

const pages =
  screenshotMode === "auth"
    ? authenticatedPages
    : screenshotMode === "public"
      ? publicPages
      : hasEStatusCredentials
        ? [...publicPages, ...authenticatedPages]
        : publicPages;

function getPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a PNG`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function waitForUsefulPaint(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function loginToEStatus(page) {
  await page.goto(`${brand.eStatusHomeUrl}/User/Login`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await waitForUsefulPaint(page);

  await page.locator("#user_id, input[name='user_id']").first().fill(eStatusCredentials.username);
  await page.locator("#password, input[name='password']").first().fill(eStatusCredentials.password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
    page.locator("#submitButton, input[type='submit']").first().click(),
  ]);
  await waitForUsefulPaint(page);

  const loginResult = await page.evaluate(() => {
    const errorText = Array.from(
      document.querySelectorAll(
        ".field-validation-error, .validation-summary-errors, .text-danger, .alert, .error"
      )
    )
      .map((element) => element.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      url: window.location.href,
      hasPasswordField: Boolean(document.querySelector("input[type='password']")),
      errorText,
    };
  });

  if (
    loginResult.hasPasswordField ||
    /login data is incorrect|invalid|try again/i.test(loginResult.errorText)
  ) {
    throw new Error(
      `eStatus login did not complete${loginResult.errorText ? `: ${loginResult.errorText}` : ""}`
    );
  }
}

async function installAppChrome(page, tabTitle, drawer) {
  await page.evaluate(
    ({ primary, tabTitle, drawer }) => {
      const oldChrome = document.getElementById("brightshore-native-chrome");
      oldChrome?.remove();
      if (window.Cookiebot && typeof window.Cookiebot.hide === "function") {
        window.Cookiebot.hide();
      }
      document.documentElement.style.background = "#f4f6f8";
      document.body.style.paddingTop = "60px";
      document.body.style.paddingBottom = "68px";
      document.body.style.margin = "0";
      document.body.style.maxWidth = "100%";
      document.body.style.overflowX = "hidden";

      const shell = document.createElement("div");
      shell.id = "brightshore-native-chrome";
      shell.innerHTML = `
        <div class="brightshore-topbar">
          <div class="brightshore-menu">☰</div>
          <div class="brightshore-title">BrightShore Mortgage</div>
          <div class="brightshore-spacer"></div>
        </div>
        ${drawer ? `
          <div class="brightshore-drawer">
            ${[
              ["⌂", "Home"],
              ["ⓘ", "About"],
              ["♡", "Hardship"],
              ["☎", "Call Us"],
              ["✉", "Email Us"],
              ["☏", "Contact"],
              ["↻", "Refinance"],
            ]
              .map(([icon, label]) => `<div class="brightshore-drawer-item"><span>${icon}</span><strong>${label}</strong></div>`)
              .join("")}
          </div>
          <div class="brightshore-scrim"></div>
        ` : ""}
        <div class="brightshore-tabbar">
          ${[
            ["⌂", "Home"],
            ["$", "Payment"],
            ["○", "Login"],
            ["?", "FAQ"],
          ]
            .map(
              ([icon, label]) =>
                `<div class="brightshore-tab ${label === tabTitle ? "active" : ""}"><span>${icon}</span><strong>${label}</strong></div>`
            )
            .join("")}
        </div>
      `;

      const style = document.createElement("style");
      style.textContent = `
        #brightshore-native-chrome, #brightshore-native-chrome * {
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
          letter-spacing: 0 !important;
        }
        #CybotCookiebotDialog,
        #CookiebotWidget,
        [id*="Cookiebot"],
        [class*="Cookiebot"],
        #acsb-button,
        .acsb-trigger,
        .acsb-widget,
        [class*="acsb"],
        [id*="acsb"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .brightshore-topbar {
          position: fixed;
          inset: 0 0 auto 0;
          height: 60px;
          z-index: 2147483647;
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr) 64px;
          align-items: center;
          background: ${primary};
          color: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,.18);
        }
        .brightshore-menu {
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 29px;
          font-weight: 700;
          border-right: 1px solid rgba(255,255,255,.2);
        }
        .brightshore-title {
          min-width: 0;
          text-align: center;
          font-size: 17px;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brightshore-tabbar {
          position: fixed;
          inset: auto 0 0 0;
          height: 68px;
          z-index: 2147483647;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          background: ${primary};
          color: #fff;
          box-shadow: 0 -2px 10px rgba(0,0,0,.16);
        }
        .brightshore-tab {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          opacity: .92;
        }
        .brightshore-tab.active { background: rgba(255,255,255,.12); opacity: 1; }
        .brightshore-tab span { font-size: 22px; line-height: 1; font-weight: 700; }
        .brightshore-tab strong { color: #fff; font-size: 12px; line-height: 1.1; font-weight: 700; }
        .brightshore-scrim {
          position: fixed;
          inset: 60px 0 68px 0;
          z-index: 2147483645;
          background: rgba(0,0,0,.24);
        }
        .brightshore-drawer {
          position: fixed;
          top: 60px;
          bottom: 68px;
          left: 0;
          width: min(75vw, 420px);
          z-index: 2147483646;
          padding: 20px 16px;
          background: #fff;
          border-right: 1px solid #d6dae0;
          box-shadow: 6px 0 18px rgba(0,0,0,.20);
        }
        .brightshore-drawer-item {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          min-height: 48px;
          color: #222a35;
        }
        .brightshore-drawer-item span { font-size: 20px; color: ${primary}; text-align: center; }
        .brightshore-drawer-item strong { font-size: 16px; font-weight: 650; }
      `;

      shell.appendChild(style);
      document.body.appendChild(shell);
    },
    { primary: brand.primary, tabTitle, drawer }
  );
}

async function capturePage(browser, device, shot) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    if (shot.requiresAuth) {
      await loginToEStatus(page);
    }
    await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForUsefulPaint(page);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  } catch (error) {
    await context.close();
    throw error;
  }

  await installAppChrome(
    page,
    shot.tabTitle || shot.title,
    shot.drawer
  );
  await page.waitForTimeout(700);

  const outDir = path.join(outRoot, device.name);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({
    path: outPath,
    fullPage: false,
    animations: "disabled",
  });

  const size = getPngSize(outPath);
  if (size.width !== device.expected.width || size.height !== device.expected.height) {
    throw new Error(
      `${outPath} was ${size.width}x${size.height}; expected ${device.expected.width}x${device.expected.height}`
    );
  }

  await context.close();
  return outPath;
}

async function main() {
  resetOutputRoot();
  fs.mkdirSync(outRoot, { recursive: true });
  const outputs = [];

  if (!["public", "auth", "all"].includes(screenshotMode)) {
    throw new Error(
      `Unknown BRIGHTSHORE_SCREENSHOT_MODE "${screenshotMode}". Use public, auth, or all.`
    );
  }

  if (screenshotMode === "auth" && !hasEStatusCredentials) {
    throw new Error(
      "BRIGHTSHORE_SCREENSHOT_MODE=auth requires BRIGHTSHORE_ESTATUS_USERNAME and BRIGHTSHORE_ESTATUS_PASSWORD in .env or the process environment."
    );
  }

  if (screenshotMode === "public") {
    console.log(
      "Generating public live-site screenshots. Set BRIGHTSHORE_SCREENSHOT_MODE=auth or all to include eStatus pages."
    );
  } else if (hasEStatusCredentials) {
    console.log("Including authenticated eStatus screenshots.");
  } else {
    console.log(
      "Skipping authenticated eStatus screenshots. Set BRIGHTSHORE_ESTATUS_USERNAME and BRIGHTSHORE_ESTATUS_PASSWORD in .env or the process environment to include them."
    );
  }

  const browser = await chromium.launch({ headless: true });

  try {
    for (const device of devices) {
      for (const shot of pages) {
        const outPath = await capturePage(browser, device, shot);
        outputs.push(outPath);
        console.log(outPath);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Generated ${outputs.length} screenshots in ${outRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
