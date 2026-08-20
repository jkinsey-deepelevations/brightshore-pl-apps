const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline/promises");
const { spawnSync } = require("node:child_process");
const { stdin, stdout } = require("node:process");
const { getBrandConfig } = require("../brands");

const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const key = argument.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      values[key] = true;
      continue;
    }

    values[key] = value;
    index += 1;
  }

  return values;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: options.binary ? null : "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: options.inherit ? "inherit" : "pipe",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = options.binary ? "" : result.stderr?.trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}${
        stderr ? `: ${stderr}` : ""
      }`
    );
  }

  return result;
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function escapeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAndroidNodes(xml) {
  return Array.from(xml.matchAll(/<node\s+([^>]+?)\s*\/?>(?:<\/node>)?/g)).map(
    ([, attributes]) => {
      const values = {};

      for (const [, key, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) {
        values[key] = escapeXml(value);
      }

      return values;
    }
  );
}

function getBoundsCenter(bounds) {
  const match = bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);

  if (!match) {
    return null;
  }

  const [, left, top, right, bottom] = match.map(Number);
  return {
    x: Math.round((left + right) / 2),
    y: Math.round((top + bottom) / 2),
  };
}

function getImageSize(buffer) {
  if (buffer.subarray(1, 4).toString("ascii") === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;

    while (offset + 8 < buffer.length) {
      while (buffer[offset] === 0xff) {
        offset += 1;
      }

      const marker = buffer[offset];
      offset += 1;

      if (marker === 0xd8 || marker === 0xd9) {
        continue;
      }

      const length = buffer.readUInt16BE(offset);
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isStartOfFrame) {
        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
        };
      }

      offset += length;
    }
  }

  throw new Error("Unable to read screenshot dimensions.");
}

function getGitMetadata() {
  const commit = run("git", ["rev-parse", "--short", "HEAD"], {
    allowFailure: true,
  }).stdout?.trim();
  const status = run("git", ["status", "--porcelain"], {
    allowFailure: true,
  }).stdout?.trim();

  return {
    commit: commit || null,
    dirty: Boolean(status),
  };
}

function getOutputDirectory({ args, brand, platform, deviceClass }) {
  if (args.output) {
    return path.resolve(root, args.output);
  }

  const build =
    platform === "ios"
      ? args.build || brand.iosBuildNumber || "tbd"
      : args.build || brand.androidVersionCode || "tbd";
  const versionFolder =
    platform === "ios"
      ? `${brand.version}-build-${build}`
      : `${brand.version}-version-code-${build}`;

  return path.join(
    root,
    "dist",
    "store-screenshots",
    brand.key,
    platform,
    versionFolder,
    args.locale || "en-US",
    deviceClass
  );
}

function writeManifest(context) {
  const manifestPath = path.join(context.outputDirectory, "manifest.json");
  const manifest = {
    brand: context.brand.key,
    appName: context.brand.appName,
    platform: context.platform,
    appId: context.appId,
    marketingVersion: context.brand.version,
    storeBuildBaseline:
      context.platform === "ios"
        ? context.brand.iosBuildNumber || null
        : context.brand.androidVersionCode || null,
    captureSource: context.source,
    device: context.device,
    deviceClass: context.deviceClass,
    git: getGitMetadata(),
    screenshots: context.screenshots,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function createContext(args) {
  const platform = String(args.platform || "").toLowerCase();

  if (!new Set(["android", "ios"]).has(platform)) {
    throw new Error('Use --platform android or --platform ios.');
  }

  const brand = getBrandConfig(args.brand);
  const deviceClass = args["device-class"] || (platform === "ios" ? "iphone-6.9" : "phone");
  const appId =
    args["app-id"] ||
    (platform === "ios" ? brand.iosBundleIdentifier : brand.androidPackage);
  const context = {
    args,
    platform,
    brand,
    appId,
    device: args.device || (platform === "ios" ? "booted" : null),
    deviceClass,
    source: args.source || "installed-release-app",
    settleMs: Number(args["settle-ms"] || 20000),
    screenshots: [],
  };

  context.outputDirectory = getOutputDirectory(context);
  fs.mkdirSync(context.outputDirectory, { recursive: true });

  if (args["capture-only"]) {
    const existingManifestPath = path.join(
      context.outputDirectory,
      "manifest.json"
    );

    if (fs.existsSync(existingManifestPath)) {
      const existingManifest = JSON.parse(
        fs.readFileSync(existingManifestPath, "utf8")
      );
      context.screenshots = existingManifest.screenshots || [];
    }
  }

  return context;
}

function getAndroidDevice(requestedDevice) {
  if (requestedDevice) {
    return requestedDevice;
  }

  const output = run("adb", ["devices"]).stdout;
  const devices = output
    .split(/\r?\n/)
    .map((line) => line.match(/^(\S+)\s+device$/)?.[1])
    .filter(Boolean);

  if (devices.length !== 1) {
    throw new Error(
      `Expected exactly one connected Android device; found ${devices.length}. Pass --device SERIAL.`
    );
  }

  return devices[0];
}

function adb(context, args, options) {
  return run("adb", ["-s", context.device, ...args], options);
}

function configureAndroid(context) {
  const width = Number(context.args.width || 1080);
  const height = Number(context.args.height || 1920);
  const density = Number(context.args.density || 420);

  context.expectedSize = { width, height };

  const sizeOutput = adb(context, ["shell", "wm", "size"]).stdout || "";
  const physicalSize = sizeOutput.match(/Physical size:\s*(\d+)x(\d+)/i);

  if (
    !physicalSize ||
    Number(physicalSize[1]) !== width ||
    Number(physicalSize[2]) !== height
  ) {
    throw new Error(
      `Android device ${context.device} has ${
        physicalSize ? `${physicalSize[1]}x${physicalSize[2]}` : "an unknown size"
      }; expected a native ${width}x${height} framebuffer. Launch the emulator with ` +
        `-skin ${width}x${height} (and -no-snapshot-load). A live wm-size override can desynchronize ` +
        "touch coordinates from screenshots."
    );
  }

  const commands = [
    ["shell", "wm", "density", String(density)],
    ["shell", "settings", "put", "system", "font_scale", "1.0"],
    ["shell", "settings", "put", "system", "accelerometer_rotation", "0"],
    ["shell", "settings", "put", "system", "user_rotation", "0"],
    ["shell", "settings", "put", "global", "window_animation_scale", "0"],
    ["shell", "settings", "put", "global", "transition_animation_scale", "0"],
    ["shell", "settings", "put", "global", "animator_duration_scale", "0"],
    ["shell", "cmd", "uimode", "night", "no"],
    ["shell", "settings", "put", "global", "sysui_demo_allowed", "1"],
    ["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "enter"],
    ["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "clock", "-e", "hhmm", "1000"],
  ];

  for (const command of commands) {
    adb(context, command, { allowFailure: true });
  }
}

function launchAndroid(context) {
  const packagePath = adb(context, ["shell", "pm", "path", context.appId], {
    allowFailure: true,
  }).stdout?.trim();

  if (!packagePath?.startsWith("package:")) {
    throw new Error(`${context.appId} is not installed on ${context.device}.`);
  }

  adb(context, ["shell", "am", "force-stop", context.appId]);
  adb(context, [
    "shell",
    "monkey",
    "-p",
    context.appId,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);
}

function getAndroidNodes(context) {
  const remotePath = "/sdcard/store-capture-window.xml";
  adb(context, ["shell", "uiautomator", "dump", remotePath]);
  const xml = adb(context, ["exec-out", "cat", remotePath]).stdout;

  return parseAndroidNodes(xml);
}

function tapAndroidNode(context, selectors) {
  const nodes = getAndroidNodes(context);
  const normalizedSelectors = selectors.map((value) => value.toLowerCase());
  let node;

  for (const selector of normalizedSelectors) {
    node = nodes.find((candidate) => {
      const searchable = [
        candidate.text,
        candidate["content-desc"],
        candidate["resource-id"],
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      return searchable.some(
        (value) =>
          value === selector ||
          value.endsWith(`/${selector}`) ||
          value.includes(`, ${selector}`)
      );
    });

    if (node) {
      break;
    }
  }
  const center = getBoundsCenter(node?.bounds);

  if (!node || !center) {
    throw new Error(
      `Could not find Android control (${selectors.join(", ")}). Available labels: ${nodes
        .flatMap((candidate) => [candidate.text, candidate["content-desc"]])
        .filter(Boolean)
        .join(" | ")}`
    );
  }

  adb(context, ["shell", "input", "tap", String(center.x), String(center.y)]);
}

function tryTapAndroidNode(context, selectors) {
  try {
    tapAndroidNode(context, selectors);
    return true;
  } catch {
    return false;
  }
}

function dismissAndroidDevelopmentWarning(context) {
  const nodes = getAndroidNodes(context);
  const warning = nodes.find((candidate) =>
    candidate["content-desc"]
      ?.toLowerCase()
      .includes("open debugger to view warnings")
  );
  const match = warning?.bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);

  if (!match) {
    return false;
  }

  const [, , top, right, bottom] = match.map(Number);
  adb(context, [
    "shell",
    "input",
    "tap",
    String(right - 58),
    String(Math.round((top + bottom) / 2)),
  ]);
  return true;
}

function dismissAndroidChatPopup(context) {
  const nodes = getAndroidNodes(context);
  const virtualAgent = nodes.find((candidate) =>
    [candidate.text, candidate["content-desc"]]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes("virtual agent"))
  );

  if (virtualAgent) {
    // The full virtual-agent panel is anchored above the bottom navigation.
    // Its accessibility nodes can include offscreen website navigation, so
    // use the visible fixed close-button position. Tapping the old upper-page
    // coordinate could activate the site's Contact Us link instead.
    tapAndroidAt(context, 0.904, 0.577);
    return true;
  }

  const proactiveNudge = nodes.find(
    (candidate) => candidate["resource-id"] === "de-chat-nudge"
  );
  const nudgeBounds = proactiveNudge?.bounds?.match(
    /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/
  );

  if (nudgeBounds) {
    const [, left, top, right, bottom] = nudgeBounds.map(Number);

    // The proactive website nudge exposes its outer bounds but not the close
    // button. Its close button is fixed near the upper-right of that box.
    adb(context, [
      "shell",
      "input",
      "tap",
      String(Math.round(left + (right - left) * 0.91)),
      String(Math.round(top + (bottom - top) * 0.27)),
    ]);
    return true;
  }

  const closeChat = nodes.find(
    (candidate) => candidate.text?.toLowerCase() === "close chat"
  );

  if (!closeChat) {
    return false;
  }

  // The chat iframe exposes CSS-relative accessibility bounds rather than
  // framebuffer coordinates. The capture workflow standardizes the phone at
  // 1080x1920, so use the visible fixed close-button position instead.
  adb(context, [
    "shell",
    "input",
    "tap",
    String(Math.round(context.expectedSize.width * 0.904)),
    String(Math.round(context.expectedSize.height * 0.577)),
  ]);
  return true;
}

function tapAndroidAt(context, xRatio, yRatio) {
  adb(context, [
    "shell",
    "input",
    "tap",
    String(Math.round(context.expectedSize.width * xRatio)),
    String(Math.round(context.expectedSize.height * yRatio)),
  ]);
}

async function waitForAndroidContent(context, requiredText) {
  const expected = requiredText.map((value) => value.toLowerCase());

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const searchable = getAndroidNodes(context)
      .flatMap((node) => [node.text, node["content-desc"]])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (expected.every((value) => searchable.includes(value))) {
      return;
    }

    await delay(1000);
  }

  throw new Error(
    `Android page did not expose expected content: ${requiredText.join(", ")}`
  );
}

async function dismissAndroidChatUntilClosed(context) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!dismissAndroidChatPopup(context)) {
      return;
    }
    await delay(1500);
  }
}

async function prepareAndroidCapture(context, inspectNativeChrome = true) {
  if (inspectNativeChrome) {
    const requiredIds = [
      "nav-menu",
      "nav-home",
      "nav-payment",
      "nav-login",
      "nav-faq",
    ];
    let missingIds = requiredIds;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nodes = getAndroidNodes(context);
      const renderedIds = new Set(
        nodes.map((node) => node["resource-id"]).filter(Boolean)
      );
      missingIds = requiredIds.filter((id) => !renderedIds.has(id));

      if (missingIds.length === 0) {
        break;
      }

      await delay(750);
    }

    if (missingIds.length > 0) {
      throw new Error(
        `Native app chrome is not ready; missing ${missingIds.join(", ")}.`
      );
    }
  }

  // Android can report the React Native views in the accessibility tree one
  // frame before SurfaceFlinger includes their glyphs. Warm the compositor
  // with a throwaway frame, then capture the next settled frame.
  adb(context, [
    "shell",
    "screencap",
    "-p",
    "/sdcard/store-screenshot-preflight.png",
  ]);
  await delay(1000);
}

function finalizeAndroidImage(rawPath, finalPath) {
  run("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    rawPath,
    "-frames:v",
    "1",
    "-pix_fmt",
    "yuvj444p",
    "-q:v",
    "2",
    finalPath,
  ]);
}

function countBrightPixels(imagePath, crop) {
  const pixels = run(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-i",
      imagePath,
      "-vf",
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},format=gray`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-",
    ],
    { binary: true }
  ).stdout;

  let brightPixels = 0;

  for (const value of pixels) {
    if (value >= 200) {
      brightPixels += 1;
    }
  }

  return brightPixels;
}

function validateAndroidNativeChrome(
  context,
  imagePath,
  includeBottomBar,
  topMinimumRatio = 0.002
) {
  const { width, height } = context.expectedSize;
  const topCrop = {
    x: 0,
    y: Math.round(height * (136 / 1920)),
    width,
    height: Math.round(height * (158 / 1920)),
  };
  const bottomCrop = {
    x: 0,
    y: Math.round(height * (1699 / 1920)),
    width,
    height: Math.round(height * (158 / 1920)),
  };
  const topBrightPixels = countBrightPixels(imagePath, topCrop);
  const topMinimum = Math.round(
    topCrop.width * topCrop.height * topMinimumRatio
  );

  if (topBrightPixels < topMinimum) {
    return {
      ready: false,
      reason: `native header has ${topBrightPixels} bright pixels; expected at least ${topMinimum}`,
    };
  }

  if (includeBottomBar) {
    const bottomBrightPixels = countBrightPixels(imagePath, bottomCrop);
    const bottomMinimum = Math.round(
      bottomCrop.width * bottomCrop.height * 0.01
    );

    if (bottomBrightPixels < bottomMinimum) {
      return {
        ready: false,
        reason: `native bottom bar has ${bottomBrightPixels} bright pixels; expected at least ${bottomMinimum}`,
      };
    }
  }

  return { ready: true };
}

function recordScreenshot(context, name, filePath) {
  const buffer = fs.readFileSync(filePath);
  const size = getImageSize(buffer);

  if (
    context.expectedSize &&
    (size.width !== context.expectedSize.width ||
      size.height !== context.expectedSize.height)
  ) {
    throw new Error(
      `${filePath} is ${size.width}x${size.height}; expected ${context.expectedSize.width}x${context.expectedSize.height}.`
    );
  }

  if (context.platform === "ios") {
    const allowedSizes = {
      "iphone-6.9": ["1260x2736", "1290x2796", "1320x2868"],
      "ipad-13": ["2048x2732", "2064x2752"],
    }[context.deviceClass];
    const actualSize = `${size.width}x${size.height}`;

    if (allowedSizes && !allowedSizes.includes(actualSize)) {
      throw new Error(
        `${actualSize} is not an accepted ${context.deviceClass} App Store size. Expected one of ${allowedSizes.join(", ")}.`
      );
    }
  }

  context.screenshots = context.screenshots.filter(
    (screenshot) => screenshot.name !== name
  );
  context.screenshots.push({
    name,
    file: path.basename(filePath),
    width: size.width,
    height: size.height,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    capturedAt: new Date().toISOString(),
  });
  writeManifest(context);
  console.log(filePath);
}

async function captureAndroid(context, name) {
  const remotePath = "/sdcard/store-screenshot.png";
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "store-shot-"));
  const rawPath = path.join(tempRoot, `${name}.png`);
  const finalPath = path.join(
    context.outputDirectory,
    `${name}__${context.expectedSize.width}x${context.expectedSize.height}.jpg`
  );

  try {
    let quality = { ready: false, reason: "no frame captured" };

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      adb(context, ["shell", "screencap", "-p", remotePath]);
      adb(context, ["pull", remotePath, rawPath]);
      quality = validateAndroidNativeChrome(
        context,
        rawPath,
        name !== "05-menu",
        // The open drawer replaces the bright hamburger with the darker brand
        // logo. Its actual complete header has fewer bright pixels than a
        // normal page, while still retaining the close control and border.
        name === "05-menu" ? 0.0015 : 0.002
      );

      if (quality.ready) {
        break;
      }

      if (attempt < 4) {
        console.warn(
          `Rejected incomplete Android frame for ${name} (attempt ${attempt}): ${quality.reason}`
        );
        await delay(1000);
      }
    }

    if (!quality.ready) {
      throw new Error(
        `Unable to capture complete Android native chrome for ${name}: ${quality.reason}`
      );
    }

    finalizeAndroidImage(rawPath, finalPath);
    recordScreenshot(context, name, finalPath);
  } finally {
    if (tempRoot.startsWith(`${os.tmpdir()}${path.sep}store-shot-`)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

async function captureAndroidStory(context) {
  context.device = getAndroidDevice(context.device);
  configureAndroid(context);
  launchAndroid(context);
  await delay(Math.min(8000, context.settleMs));
  dismissAndroidDevelopmentWarning(context);
  await delay(context.settleMs);
  if (dismissAndroidDevelopmentWarning(context)) {
    await delay(1500);
  }
  await dismissAndroidChatUntilClosed(context);

  await prepareAndroidCapture(context);
  // The first proactive chat nudge can appear just after the initial page and
  // native chrome report ready. Give that delayed state one final cleanup pass
  // before recording the Home screenshot.
  await delay(4000);
  await dismissAndroidChatUntilClosed(context);
  await prepareAndroidCapture(context);
  await captureAndroid(context, "01-home");

  const steps = [
    {
      selectors: ["nav-payment", "Payment tab"],
      name: "02-payment",
      extraSettleMs: 12000,
    },
    { selectors: ["nav-login", "Login tab"], name: "03-login" },
    { selectors: ["nav-faq", "FAQ tab"], name: "04-faq" },
  ];

  for (const step of steps) {
    tapAndroidNode(context, step.selectors);
    await delay(context.settleMs + (step.extraSettleMs || 0));

    if (step.name === "02-payment") {
      if (tryTapAndroidNode(context, ["pay-as-guest"])) {
        await delay(3000);
      }
      await waitForAndroidContent(context, [
        "Loan Number",
        "Last 4 of Social Security Number",
      ]);
    } else if (step.name === "03-login") {
      await waitForAndroidContent(context, ["Password"]);
    } else if (step.name === "04-faq") {
      await waitForAndroidContent(
        context,
        context.brand.key === "essex"
          ? ["Smooth Servicing"]
          : ["HOW CAN WE HELP"]
      );
    }

    await dismissAndroidChatUntilClosed(context);
    await prepareAndroidCapture(context);
    await captureAndroid(context, step.name);
  }

  tapAndroidNode(context, ["nav-home", "Home tab"]);
  await delay(context.settleMs);
  await dismissAndroidChatUntilClosed(context);
  tapAndroidNode(context, ["nav-menu", "Open menu"]);
  await delay(2500);
  await prepareAndroidCapture(context, false);
  await captureAndroid(context, "05-menu");

  tapAndroidNode(context, [
    context.brand.drawerLabels?.about || "About",
  ]);
  await delay(context.settleMs);
  if (tryTapAndroidNode(context, ["I understand"])) {
    await delay(2000);
  }
  await dismissAndroidChatUntilClosed(context);
  await prepareAndroidCapture(context);
  await captureAndroid(context, "06-about");

  tapAndroidNode(context, ["nav-menu", "Open menu"]);
  await delay(2500);
  tapAndroidNode(context, [
    context.brand.drawerLabels?.hardship || "Hardship",
  ]);
  await delay(context.settleMs);
  await dismissAndroidChatUntilClosed(context);
  await prepareAndroidCapture(context);
  await captureAndroid(context, "07-hardship");
}

function xcrun(context, args, options) {
  return run("xcrun", ["simctl", ...args], options);
}

function configureIos(context) {
  xcrun(context, ["ui", context.device, "appearance", "light"], {
    allowFailure: true,
  });
  xcrun(
    context,
    [
      "status_bar",
      context.device,
      "override",
      "--time",
      "9:41",
      "--batteryState",
      "charged",
      "--batteryLevel",
      "100",
      "--cellularBars",
      "4",
      "--wifiBars",
      "3",
    ],
    { allowFailure: true }
  );
  xcrun(context, ["privacy", context.device, "grant", "tracking", context.appId], {
    allowFailure: true,
  });
}

function captureIos(context, name) {
  const finalPath = path.join(context.outputDirectory, `${name}.jpg`);
  xcrun(context, [
    "io",
    context.device,
    "screenshot",
    "--type=jpeg",
    finalPath,
  ]);
  recordScreenshot(context, name, finalPath);
}

async function captureIosStory(context) {
  configureIos(context);
  xcrun(context, ["terminate", context.device, context.appId], {
    allowFailure: true,
  });
  xcrun(context, ["launch", context.device, context.appId]);
  await delay(context.settleMs);

  const prompts = [
    ["01-home", null],
    ["02-payment", "Open the Payment tab, wait for the live page, then press Enter."],
    ["03-login", "Open the Login tab, wait for the live page, then press Enter."],
    ["04-faq", "Open the FAQ tab, wait for the live page, then press Enter."],
    ["05-menu", "Return Home, open the navigation drawer, then press Enter."],
    ["06-about", "Open About from the drawer, wait for the live page, then press Enter."],
    ["07-hardship", "Open Hardship from the drawer, wait for the live page, then press Enter."],
  ];
  const prompt = readline.createInterface({ input: stdin, output: stdout });

  try {
    for (const [name, instruction] of prompts) {
      if (instruction) {
        await prompt.question(`${instruction}\n`);
      }
      captureIos(context, name);
    }
  } finally {
    prompt.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = createContext(args);

  if (args["capture-only"]) {
    const name = String(args["capture-only"]);

    if (context.platform === "android") {
      context.device = getAndroidDevice(context.device);
      configureAndroid(context);
      await prepareAndroidCapture(context, name !== "05-menu");
      await captureAndroid(context, name);
    } else {
      configureIos(context);
      captureIos(context, name);
    }
  } else if (context.platform === "android") {
    await captureAndroidStory(context);
  } else {
    await captureIosStory(context);
  }

  console.log(
    `Captured ${context.screenshots.length} installed-app screenshots in ${context.outputDirectory}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
