const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const outRoot = path.join(root, "dist", "app-store-screenshots");

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
    name: "iphone-6.9",
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    expected: { width: 1290, height: 2796 },
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

const pages = [
  {
    name: "01-home",
    title: "Home",
    url: brand.baseUrl,
    showcase: {
      headline: "Helping Clients Retain More Than Loans",
      body: "Manage your mortgage from the BrightShore Mortgage app.",
      action: "Buy a Home",
    },
  },
  {
    name: "02-payment",
    title: "Payment",
    url: `${brand.baseUrl}/manage#QuickAction`,
    showcase: {
      headline: "Make a Payment",
      body: "Quick access to payment tools and account services.",
      action: "Payment Center",
    },
  },
  { name: "03-login", title: "Login", url: brand.eStatusHomeUrl },
  {
    name: "04-faq",
    title: "FAQ",
    url: brand.faqUrl,
    showcase: {
      headline: "Get Answers Fast",
      body: "Find support for payments, escrow, assistance, and account access.",
      action: "FAQ",
    },
  },
  {
    name: "05-about",
    title: "About",
    url: `${brand.baseUrl}/${brand.aboutSlug}`,
    showcase: {
      headline: "Behind Every Experience",
      body: "Digital tools and servicing expertise for every borrower interaction.",
      action: "Learn More",
    },
  },
  {
    name: "06-hardship",
    title: "Hardship",
    url: `${brand.baseUrl}/mortgage-assistance`,
    showcase: {
      headline: "Mortgage Assistance",
      body: "Support options when you need help with your loan.",
      action: "View Options",
    },
  },
  {
    name: "07-contact",
    title: "Contact",
    url: brand.chatUrl,
    showcase: {
      headline: "Contact BrightShore",
      body: "Reach the BrightShore team directly from the app.",
      action: "Contact Us",
    },
  },
  {
    name: "08-refinance",
    title: "Refinance",
    url: `${brand.baseUrl}/refinancing-your-loan`,
    showcase: {
      headline: "Refinance Options",
      body: "Explore mortgage solutions for your next chapter.",
      action: "Refinance",
    },
  },
  {
    name: "09-menu",
    title: "Menu",
    url: brand.baseUrl,
    drawer: true,
    showcase: {
      headline: "Everything in Reach",
      body: "Navigate home, account support, contact, and refinance tools.",
      action: "Open Menu",
    },
  },
];

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

async function getShowcaseImage(page) {
  return page
    .evaluate(() => {
      const images = Array.from(document.images)
        .map((image) => ({
          src: image.currentSrc || image.src,
          area: (image.naturalWidth || 0) * (image.naturalHeight || 0),
        }))
        .filter((image) => image.src && image.area > 20000);

      const preferred =
        images.find((image) => /main|hero|home|quick|assistance|refinance|story/i.test(image.src)) ||
        images[0];

      return preferred?.src || "";
    })
    .catch(() => "");
}

async function installAppChrome(page, title, drawer, showcase, showcaseImage) {
  await page.evaluate(
    ({ primary, title, drawer, showcase, showcaseImage }) => {
      const oldChrome = document.getElementById("brightshore-native-chrome");
      oldChrome?.remove();
      document.getElementById("brightshore-showcase")?.remove();
      if (window.Cookiebot && typeof window.Cookiebot.hide === "function") {
        window.Cookiebot.hide();
      }
      document.documentElement.style.background = "#f4f6f8";
      document.body.style.paddingTop = "60px";
      document.body.style.paddingBottom = "68px";
      document.body.style.margin = "0";
      document.body.style.maxWidth = "100%";
      document.body.style.overflowX = "hidden";

      if (showcase) {
        document.documentElement.classList.add("brightshore-showcase-active");
        const showcaseElement = document.createElement("main");
        showcaseElement.id = "brightshore-showcase";
        showcaseElement.innerHTML = `
          <section>
            <p class="brightshore-kicker">BrightShore Mortgage</p>
            <h1>${showcase.headline}</h1>
            <p class="brightshore-copy">${showcase.body}</p>
            <div class="brightshore-action">${showcase.action}</div>
          </section>
        `;
        document.body.appendChild(showcaseElement);
      } else {
        document.documentElement.classList.remove("brightshore-showcase-active");
      }

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
                `<div class="brightshore-tab ${label === title ? "active" : ""}"><span>${icon}</span><strong>${label}</strong></div>`
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
        .brightshore-showcase-active body > *:not(#brightshore-native-chrome):not(#brightshore-showcase) {
          display: none !important;
        }
        #brightshore-showcase {
          position: fixed;
          inset: 60px 0 68px 0;
          z-index: 2147483000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          overflow: hidden;
          color: #fff;
          background:
            linear-gradient(115deg, rgba(7, 10, 28, .82), rgba(31, 48, 132, .60) 48%, rgba(7, 10, 28, .82)),
            ${showcaseImage ? `url("${showcaseImage}")` : "linear-gradient(135deg, #101427, #20275a)"};
          background-size: cover;
          background-position: center;
        }
        #brightshore-showcase section {
          width: min(86vw, 780px);
          text-align: center;
          text-shadow: 0 2px 14px rgba(0,0,0,.42);
        }
        #brightshore-showcase .brightshore-kicker {
          margin: 0 0 16px;
          font-size: clamp(15px, 2.6vw, 24px);
          line-height: 1.1;
          font-weight: 800;
          text-transform: uppercase;
        }
        #brightshore-showcase h1 {
          margin: 0 auto 20px;
          max-width: 760px;
          color: #fff;
          font-size: clamp(40px, 8.2vw, 78px);
          line-height: 1.04;
          font-weight: 850;
          letter-spacing: 0;
        }
        #brightshore-showcase .brightshore-copy {
          margin: 0 auto 34px;
          max-width: 680px;
          color: #fff;
          font-size: clamp(22px, 4.7vw, 38px);
          line-height: 1.22;
          font-weight: 600;
        }
        #brightshore-showcase .brightshore-action {
          width: min(76vw, 560px);
          min-height: 76px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 24px;
          border: 2px solid rgba(255,255,255,.72);
          border-radius: 8px;
          background: rgba(0,0,0,.20);
          color: #fff;
          font-size: clamp(26px, 5.5vw, 46px);
          font-weight: 750;
          line-height: 1.1;
          text-align: center;
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
    { primary: brand.primary, title, drawer, showcase, showcaseImage }
  );
}

async function buildFallback(page, title) {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #f7f9ff, #e7ebff);
            color: #222a35;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          }
          main {
            width: min(78vw, 620px);
            padding: 34px;
            border: 1px solid #dce1ef;
            border-radius: 8px;
            background: rgba(255,255,255,.92);
            box-shadow: 0 18px 42px rgba(34,42,80,.14);
          }
          h1 { margin: 0 0 10px; color: ${brand.primary}; font-size: 38px; line-height: 1.05; }
          p { margin: 0; font-size: 18px; line-height: 1.4; }
        </style>
      </head>
      <body><main><h1>${title}</h1><p>BrightShore Mortgage mobile app</p></main></body>
    </html>
  `);
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
    await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForUsefulPaint(page);
  } catch (error) {
    console.warn(`Falling back for ${shot.name}: ${error.message}`);
    await buildFallback(page, shot.title);
  }

  const showcaseImage = shot.showcase ? await getShowcaseImage(page) : "";
  await installAppChrome(
    page,
    shot.title,
    shot.drawer,
    shot.showcase,
    showcaseImage
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
  fs.mkdirSync(outRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const outputs = [];

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
