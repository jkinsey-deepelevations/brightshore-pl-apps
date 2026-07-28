import { JSX, useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CookieManager from "@react-native-cookies/cookies";
import ReactNativeBlobUtil from "react-native-blob-util";
import FileViewer from "react-native-file-viewer";
import * as Print from "expo-print";
import { WebView } from "react-native-webview";
import ContactAccordion from "../components/Accordion";
import BottomBar from "../components/BottomBar";
import { SafeAreaView } from "react-native-safe-area-context";
import brand from "../brand";
import NetInfo from "@react-native-community/netinfo";
import { moderateScale } from "react-native-size-matters";
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";

const DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "rtf",
];

const DOCUMENT_URL_HINTS = [
  "download",
  "file",
  "files",
  "attachment",
  "attachments",
  "print",
  "statement",
  "statements",
  "notice",
  "notices",
  "letter",
  "letters",
];

const DOCUMENT_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
};

const isDocumentUrl = (uri: string) => {
  try {
    const url = new URL(uri);
    const path = url.pathname.toLowerCase();
    const query = url.search.toLowerCase();
    const isDocumentsIndex =
      path === "/documents" || path.endsWith("/documents");

    if (isDocumentsIndex) {
      return false;
    }

    const hasDocumentExtension = DOCUMENT_EXTENSIONS.some((extension) =>
      path.endsWith(`.${extension}`)
    );
    const hasDocumentHint = DOCUMENT_URL_HINTS.some(
      (hint) => path.includes(hint) || query.includes(hint)
    );

    return hasDocumentExtension || hasDocumentHint;
  } catch {
    return false;
  }
};

const getHeader = (
  headers: Record<string, string | string[] | undefined>,
  headerName: string
) => {
  const matchingKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === headerName.toLowerCase()
  );
  const value = matchingKey ? headers[matchingKey] : undefined;

  return Array.isArray(value) ? value[0] : value;
};

const getDocumentExtension = (
  uri: string,
  contentType?: string,
  fallback = "pdf"
) => {
  try {
    const { pathname } = new URL(uri);
    const extension = pathname.split(".").pop()?.toLowerCase();

    if (extension && DOCUMENT_EXTENSIONS.includes(extension)) {
      return extension;
    }
  } catch {}

  const mimeType = contentType?.split(";")[0]?.trim().toLowerCase();

  return (mimeType && DOCUMENT_MIME_EXTENSIONS[mimeType]) || fallback;
};

const getDocumentFilename = (
  uri: string,
  headers: Record<string, string | string[] | undefined>
) => {
  const disposition = getHeader(headers, "content-disposition");
  const contentType = getHeader(headers, "content-type");
  const fallbackExtension = getDocumentExtension(uri, contentType);
  const dispositionMatch = disposition?.match(
    /filename\*?=(?:UTF-8'')?["']?([^"';]+)/
  );
  const rawFilename = dispositionMatch?.[1]
    ? decodeURIComponent(dispositionMatch[1])
    : undefined;
  const filename =
    rawFilename ||
    (() => {
      try {
        return new URL(uri).pathname.split("/").pop();
      } catch {
        return undefined;
      }
    })() ||
    `document.${fallbackExtension}`;
  const safeFilename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

  return safeFilename.includes(".")
    ? safeFilename
    : `${safeFilename}.${fallbackExtension}`;
};

const getCookieHeader = async (uri: string) => {
  try {
    const cookies = await CookieManager.get(uri);

    return Object.values(cookies)
      .filter((cookie) => cookie.name && /^[^=;\s]+$/.test(cookie.name))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  } catch (error) {
    logDocumentEvent(
      "native cookie read failed",
      error instanceof Error ? error.message : error
    );
    return "";
  }
};

const mergeCookieHeaders = (...cookieHeaders: Array<string | undefined>) => {
  const cookieMap = new Map<string, string>();

  cookieHeaders.forEach((cookieHeader) => {
    cookieHeader
      ?.split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .forEach((cookie) => {
        const separatorIndex = cookie.indexOf("=");

        if (separatorIndex <= 0) {
          return;
        }

        const name = cookie.slice(0, separatorIndex).trim();
        const value = cookie.slice(separatorIndex + 1).trim();

        if (name && /^[^=;\s]+$/.test(name)) {
          cookieMap.set(name, value);
        }
      });
  });

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
};

const logDocumentEvent = (_event: string, _details?: unknown) => {};

const getAbsoluteUrl = (path: string, baseUri = brand.eStatusHomeUrl) =>
  new URL(path, baseUri).href;

const getNormalizedUri = (uri: string) => {
  try {
    const url = new URL(uri);
    return url.href.replace(/\/$/, "");
  } catch {
    return uri.replace(/\/$/, "");
  }
};

const getUriHostname = (uri: string) => {
  try {
    return new URL(uri).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const eStatusHostname = getUriHostname(brand.eStatusHomeUrl);
const publicMortgageHostnames = Array.from(
  new Set(
    [getUriHostname(brand.baseUrl), ...brand.publicHostnames]
      .map((hostname) => hostname.toLowerCase())
      .filter(Boolean)
  )
);

const isEStatusUri = (uri: string) => {
  return getUriHostname(uri) === eStatusHostname;
};

const isEStatusLoginUri = (uri: string) => {
  try {
    const url = new URL(uri);
    return (
      url.hostname.toLowerCase() === eStatusHostname &&
      url.pathname.toLowerCase().replace(/\/$/, "") === "/user/login"
    );
  } catch {
    return false;
  }
};

const isManageUri = (uri: string) => {
  try {
    const url = new URL(uri);
    return (
      publicMortgageHostnames.includes(url.hostname.toLowerCase()) &&
      url.pathname.toLowerCase().replace(/\/$/, "") === "/manage"
    );
  } catch {
    return false;
  }
};

const escapeHtmlAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const getPrintableHtml = (html: string, baseUri?: string) => {
  const trimmedHtml = html.trim();
  const baseTag = baseUri
    ? `<base href="${escapeHtmlAttribute(baseUri)}">`
    : "";

  if (/<html[\s>]/i.test(trimmedHtml)) {
    return trimmedHtml.replace(/<head([\s\S]*?)>/i, `<head$1>${baseTag}`);
  }

  return `<!doctype html><html><head><meta charset="utf-8">${baseTag}</head><body>${trimmedHtml}</body></html>`;
};

export default function HomeScreen(): JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const [currentUri, setCurrentUri] = useState(brand.manageUrl);
  const [shouldOpenEmbeddedLogin, setShouldOpenEmbeddedLogin] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0); // for forcing reloads
  const [isOffline, setIsOffline] = useState(false);
  const [isOpeningDocument, setIsOpeningDocument] = useState(false);
  const [isTrackingPermissionReady, setIsTrackingPermissionReady] = useState(
    Platform.OS !== "ios"
  );
  const [isTrackingAuthorized, setIsTrackingAuthorized] = useState(
    Platform.OS !== "ios"
  );

  const shouldBlockNativePrint = (sourceUri?: string) => {
    return isEStatusUri(currentUri) || (!!sourceUri && isEStatusUri(sourceUri));
  };

  const handleNavigate = (uri: string) => {
    const nextUri =
      getNormalizedUri(uri) === getNormalizedUri(brand.manageLoginUrl)
        ? brand.manageUrl
        : uri;

    if (
      nextUri === brand.eStatusHomeUrl &&
      isEStatusUri(currentUri) &&
      !isEStatusLoginUri(currentUri)
    ) {
      return;
    }

    if (getNormalizedUri(uri) === getNormalizedUri(brand.manageLoginUrl)) {
      setShouldOpenEmbeddedLogin(true);

      if (isManageUri(currentUri)) {
        setShouldOpenEmbeddedLogin(false);
        setTimeout(openEmbeddedLoginPortal, 50);
      }
    }

    if (getNormalizedUri(nextUri) !== getNormalizedUri(currentUri)) {
      setCurrentUri(nextUri);
    }
  };

  const openEmbeddedLoginPortal = () => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        var attempts = 0;
        var maxAttempts = 20;

        function findLoginLink() {
          var links = Array.from(document.querySelectorAll('#main-content a[href], a[href]'));

          return links.find(function(link) {
            var href = String(link.href || '').toLowerCase();
            var text = String(link.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();

            return href.indexOf('brightshoremortgage.estatusconnect.com/user/login') >= 0 &&
              text.indexOf('login') >= 0;
          });
        }

        function openPortal() {
          var loginLink = findLoginLink();
          var portalAlreadyOpen =
            document.querySelector('.estatus-portal-dialog') ||
            document.documentElement.classList.contains('estatus-portal-open') ||
            document.body.classList.contains('estatus-portal-open');

          if (portalAlreadyOpen) {
            return;
          }

          if (loginLink) {
            loginLink.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            }));
          }

          attempts += 1;

          if (attempts < maxAttempts && !document.querySelector('.estatus-portal-dialog')) {
            window.setTimeout(openPortal, 250);
          }
        }

        openPortal();
        true;
      })();
    `);
  };

  const openPendingEmbeddedLogin = (uri: string) => {
    if (!shouldOpenEmbeddedLogin || !isManageUri(uri)) {
      return;
    }

    setShouldOpenEmbeddedLogin(false);
    setTimeout(openEmbeddedLoginPortal, 700);
  };

  const openAuthenticatedDocument = async (
    uri: string,
    manageBusy = true,
    cookieHeaderOverride?: string
  ) => {
    if (manageBusy && isOpeningDocument) {
      logDocumentEvent("ignored duplicate open request", uri);
      return;
    }

    if (manageBusy) {
      setIsOpeningDocument(true);
    }

    try {
      logDocumentEvent("opening", uri);
      const nativeCookieHeader = await getCookieHeader(uri);
      const cookieHeader = mergeCookieHeaders(
        cookieHeaderOverride,
        nativeCookieHeader
      );
      const headers: Record<string, string> = {
        Accept: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/rtf",
          "*/*",
        ].join(", "),
      };

      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      logDocumentEvent("fetching with cookies", {
        uri,
        cookieCount: cookieHeader ? cookieHeader.split("; ").length : 0,
      });

      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
      }).fetch("GET", uri, headers);
      const responseInfo = response.info();
      const responseHeaders = responseInfo.headers || {};
      const contentType = getHeader(responseHeaders, "content-type");
      const normalizedContentType = contentType
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();

      logDocumentEvent("response", {
        status: responseInfo.status,
        contentType,
        contentDisposition: getHeader(responseHeaders, "content-disposition"),
      });

      if (responseInfo.status < 200 || responseInfo.status >= 300) {
        throw new Error(
          `Document request failed with status ${responseInfo.status}`
        );
      }

      if (normalizedContentType === "text/html") {
        const html = await ReactNativeBlobUtil.fs.readFile(response.path(), "utf8");
        await printHtml(html, uri, getDocumentFilename(uri, responseHeaders));
        return;
      }

      const filename = getDocumentFilename(uri, responseHeaders);
      const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${Date.now()}-${filename}`;

      await ReactNativeBlobUtil.fs.mv(response.path(), path);
      logDocumentEvent("saved", { filename, path });
      await FileViewer.open(path, {
        displayName: filename,
        showOpenWithDialog: false,
        showAppsSuggestions: true,
      });
      logDocumentEvent("viewer opened", filename);
    } catch (error) {
      logDocumentEvent("failed", error instanceof Error ? error.message : error);
      Alert.alert(
        "Unable to open document",
        "Please try again. If this continues, the document may require a different viewer on this device."
      );
    } finally {
      if (manageBusy) {
        setIsOpeningDocument(false);
      }
    }
  };

  const openDocumentByKey = async (docKey: string, pageCookieHeader?: string) => {
    if (isOpeningDocument) {
      logDocumentEvent("ignored duplicate document key request");
      return;
    }

    setIsOpeningDocument(true);

    try {
      const tokenUri = getAbsoluteUrl(
        `/Documents/GetDocToken?docKey=${encodeURIComponent(docKey)}`
      );
      const nativeCookieHeader = await getCookieHeader(tokenUri);
      const cookieHeader = mergeCookieHeaders(
        pageCookieHeader,
        nativeCookieHeader
      );
      const headers: Record<string, string> = {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      };

      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      logDocumentEvent("fetching document token", {
        tokenUri,
        cookieCount: cookieHeader ? cookieHeader.split("; ").length : 0,
      });

      const tokenResponse = await ReactNativeBlobUtil.fetch(
        "GET",
        tokenUri,
        headers
      );
      const tokenInfo = tokenResponse.info();
      const tokenBody = tokenResponse.data;

      logDocumentEvent("token response", {
        status: tokenInfo.status,
        body: tokenBody?.slice?.(0, 200),
      });

      if (tokenInfo.status < 200 || tokenInfo.status >= 300) {
        throw new Error(`Token request failed with status ${tokenInfo.status}`);
      }

      const tokenJson = JSON.parse(tokenBody);

      if (!tokenJson?.success || !tokenJson.data) {
        throw new Error("Document token response did not include a token");
      }

      await openAuthenticatedDocument(
        getAbsoluteUrl(
          `/Documents/GetDocumentByDocToken?docToken=${encodeURIComponent(
            tokenJson.data
          )}`
        ),
        false,
        cookieHeader
      );
    } catch (error) {
      logDocumentEvent(
        "document key failed",
        error instanceof Error ? error.message : error
      );
      Alert.alert(
        "Unable to open document",
        "Please try again. If this continues, the document may require a different viewer on this device."
      );
    } finally {
      setIsOpeningDocument(false);
    }
  };

  const printHtml = async (html: string, baseUri?: string, title?: string) => {
    if (shouldBlockNativePrint(baseUri)) {
      logDocumentEvent("blocked estatus print html", baseUri || currentUri);
      return;
    }

    try {
      const printableHtml = getPrintableHtml(html, baseUri);
      await Print.printAsync({
        html: printableHtml,
        orientation: Print.Orientation.portrait,
      });
      logDocumentEvent("print opened", title);
    } catch (error) {
      logDocumentEvent("print failed", error instanceof Error ? error.message : error);
      Alert.alert(
        "Unable to print",
        "Please try again. If this continues, open the document and use your device print options."
      );
    }
  };

  const printAuthenticatedUrl = async (
    uri: string,
    cookieHeaderOverride?: string
  ) => {
    if (shouldBlockNativePrint(uri)) {
      logDocumentEvent("blocked estatus print url", uri);
      return;
    }

    if (isOpeningDocument) {
      logDocumentEvent("ignored duplicate print url request", uri);
      return;
    }

    setIsOpeningDocument(true);

    try {
      const nativeCookieHeader = await getCookieHeader(uri);
      const cookieHeader = mergeCookieHeaders(
        cookieHeaderOverride,
        nativeCookieHeader
      );
      const headers: Record<string, string> = {
        Accept: "text/html, application/pdf, */*",
      };

      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
      }).fetch("GET", uri, headers);
      const responseInfo = response.info();
      const responseHeaders = responseInfo.headers || {};
      const contentType = getHeader(responseHeaders, "content-type");
      const normalizedContentType = contentType
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();

      if (responseInfo.status < 200 || responseInfo.status >= 300) {
        throw new Error(
          `Print request failed with status ${responseInfo.status}`
        );
      }

      if (normalizedContentType === "application/pdf") {
        const printUri = response.path().startsWith("file://")
          ? response.path()
          : `file://${response.path()}`;
        await Print.printAsync({ uri: printUri });
        return;
      }

      const html = await ReactNativeBlobUtil.fs.readFile(response.path(), "utf8");
      await printHtml(html, uri, getDocumentFilename(uri, responseHeaders));
    } catch (error) {
      logDocumentEvent(
        "print url failed",
        error instanceof Error ? error.message : error
      );
      Alert.alert(
        "Unable to print",
        "Please try again. If this continues, open the document and use your device print options."
      );
    } finally {
      setIsOpeningDocument(false);
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    let isMounted = true;
    let appStateSubscription: { remove: () => void } | undefined;
    let isResolvingPermission = false;

    const resolveTrackingPermission = async () => {
      if (isResolvingPermission) {
        return;
      }

      isResolvingPermission = true;
      try {
        const currentPermission = await getTrackingPermissionsAsync();
        const permission =
          currentPermission.status === PermissionStatus.UNDETERMINED
            ? await requestTrackingPermissionsAsync()
            : currentPermission;

        if (!isMounted) {
          return;
        }

        setIsTrackingAuthorized(permission.status === PermissionStatus.GRANTED);
        setIsTrackingPermissionReady(true);
      } catch {
        if (isMounted) {
          setIsTrackingAuthorized(false);
          setIsTrackingPermissionReady(true);
        }
      } finally {
        isResolvingPermission = false;
      }
    };

    const watchWhenAppIsActive = (appState: AppStateStatus) => {
      if (appState === "active") {
        resolveTrackingPermission();
      }
    };

    watchWhenAppIsActive(AppState.currentState);
    appStateSubscription = AppState.addEventListener(
      "change",
      watchWhenAppIsActive
    );

    return () => {
      isMounted = false;
      appStateSubscription?.remove();
    };
  }, []);

  const injectedJavaScript = `
  (function() {
    const isTrackingAuthorized = ${JSON.stringify(isTrackingAuthorized)};
    const currentHostname = window.location.hostname.toLowerCase();
    const currentPath = window.location.pathname.toLowerCase();
    const eStatusHostname = ${JSON.stringify(eStatusHostname)};
    const publicMortgageHostnames = ${JSON.stringify(publicMortgageHostnames)};
    const isConfiguredEStatusHost = currentHostname === eStatusHostname;
    const normalizedPath = currentPath.replace(/\\/+$/, '');
    const isConfiguredEStatusLoginPath =
      isConfiguredEStatusHost &&
      (normalizedPath === '/user/login' ||
        normalizedPath === '/login' ||
        normalizedPath.endsWith('/login'));
    const isConfiguredEStatusEntryPath =
      isConfiguredEStatusHost && (normalizedPath === '' || normalizedPath === '/');
    const isPublicMortgageHost = publicMortgageHostnames.indexOf(currentHostname) >= 0;
    const shouldPreparePolish = isConfiguredEStatusHost || isPublicMortgageHost;
    const headElement = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    function appendToDocumentHead(element) {
      headElement.appendChild(element);
    }

    if (headElement && shouldPreparePolish && !document.documentElement.classList.contains('brightshore-webview-ready')) {
      document.documentElement.classList.add('brightshore-webview-preparing');
      const preparationStyle = document.createElement('style');
      preparationStyle.innerHTML = 'html.brightshore-webview-preparing body { opacity: 0 !important; } html.brightshore-webview-ready body { opacity: 1 !important; }';
      appendToDocumentHead(preparationStyle);
    }
    const style = document.createElement('style');
    style.id = 'brightshore-mobile-webview-styles';
    const sharedStyles = [
      'html.brightshore-webview-preparing body { opacity: 0 !important; }',
      'html.brightshore-webview-ready body { opacity: 1 !important; }',
      'iframe[src*="five9"], .five9-frame { display: none !important; }',
      '#CybotCookiebotDialog, #CookiebotWidget { display: none !important; visibility: hidden !important; }'
    ];
    var publicMortgageStyles = [
      'html, body { width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; }',
      'body { margin: 0 !important; text-rendering: optimizeLegibility !important; }',
      'body.brightshore-public-home > header { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 30 !important; width: 100vw !important; max-width: 100vw !important; height: 88px !important; min-height: 88px !important; display: grid !important; grid-template-columns: 70px minmax(0, 1fr) 68px 84px !important; align-items: stretch !important; border-bottom: 1px solid rgba(255,255,255,0.22) !important; background: rgba(18, 25, 51, 0.42) !important; color: #fff !important; }',
      'body.brightshore-public-home > header > button { width: 70px !important; min-width: 70px !important; border-right: 1px solid rgba(255,255,255,0.22) !important; background: rgba(8, 10, 16, 0.55) !important; color: #fff !important; }',
      'body.brightshore-public-home > header svg { width: 30px !important; height: 30px !important; stroke-width: 1.7 !important; }',
      'body.brightshore-public-home > header > div { width: auto !important; min-width: 0 !important; max-width: 100% !important; }',
      'body.brightshore-public-home > header > div:nth-child(2) { display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 8px !important; }',
      'body.brightshore-public-home > header > div:nth-child(2) img { max-width: 132px !important; max-height: 50px !important; object-fit: contain !important; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.28)) !important; }',
      'body.brightshore-public-home > header > div:nth-child(3), body.brightshore-public-home > header > div:nth-child(4) { width: auto !important; border-left: 1px solid rgba(255,255,255,0.22) !important; padding: 0 6px !important; font-size: 13px !important; line-height: 1.15 !important; text-align: center !important; color: #fff !important; }',
      'body.brightshore-public-home > header > div:nth-child(3) a, body.brightshore-public-home > header > div:nth-child(4) a { color: #fff !important; font-size: 13px !important; font-weight: 700 !important; line-height: 1.15 !important; text-decoration-color: #fff !important; }',
      'body.brightshore-public-home > main, body.brightshore-public-home > main > section:first-of-type { width: 100% !important; max-width: 100vw !important; overflow-x: hidden !important; }',
      'body.brightshore-public-home > main > section:first-of-type h1 { max-width: calc(100vw - 32px) !important; margin-left: auto !important; margin-right: auto !important; font-size: 25px !important; line-height: 1.1 !important; letter-spacing: 0 !important; overflow-wrap: break-word !important; }',
      'body.brightshore-public-home > main > section:first-of-type p { max-width: calc(100vw - 32px) !important; margin-left: auto !important; margin-right: auto !important; font-size: 15px !important; line-height: 1.32 !important; letter-spacing: 0 !important; overflow-wrap: break-word !important; }',
      'body.brightshore-public-home > main > section:first-of-type > section { padding-left: 18px !important; padding-right: 18px !important; text-align: center !important; }',
      'body.brightshore-public-home > main > section:first-of-type > section > div:first-child { width: 100% !important; max-width: 420px !important; margin-left: auto !important; margin-right: auto !important; }',
      'body.brightshore-public-home > main > section:first-of-type > section > div:first-child > div { width: 100% !important; margin-top: 12px !important; display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; align-items: stretch !important; justify-content: center !important; }',
      'body.brightshore-public-home > main > section:first-of-type > section > div:first-child > div a { width: 100% !important; min-height: 48px !important; padding: 10px 8px !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #fff !important; font-size: 14px !important; font-weight: 700 !important; line-height: 1.15 !important; text-align: center !important; white-space: normal !important; overflow-wrap: normal !important; word-break: normal !important; }',
      '@media (min-width: 700px) { body.brightshore-public-home > main > section:first-of-type h1 { font-size: 32px !important; } body.brightshore-public-home > main > section:first-of-type p { font-size: 18px !important; max-width: 520px !important; } body.brightshore-public-home > main > section:first-of-type > section > div:first-child { max-width: 720px !important; } body.brightshore-public-home > main > section:first-of-type > section > div:first-child > div { gap: 20px !important; } body.brightshore-public-home > main > section:first-of-type > section > div:first-child > div a { min-height: 58px !important; font-size: 20px !important; } }',
      '@media (max-width: 380px) { body.brightshore-public-home > header { grid-template-columns: 58px minmax(0, 1fr) 58px 70px !important; height: 82px !important; min-height: 82px !important; } body.brightshore-public-home > header > button { width: 58px !important; min-width: 58px !important; } body.brightshore-public-home > header > div:nth-child(2) img { max-width: 118px !important; } body.brightshore-public-home > main > section:first-of-type h1 { font-size: 22px !important; } body.brightshore-public-home > main > section:first-of-type p { font-size: 14px !important; } body.brightshore-public-home > main > section:first-of-type > section > div:first-child > div { grid-template-columns: 1fr !important; max-width: 260px !important; } body.brightshore-public-home > main > section:first-of-type > section > div:first-child > div a { min-height: 42px !important; } }'
    ];
    var publicMortgageInteriorStyles = [
      'html, body { width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; }',
      'body { margin: 0 !important; text-rendering: optimizeLegibility !important; }',
      'body.brightshore-public-interior > header { z-index: 30 !important; width: 100vw !important; max-width: 100vw !important; margin: 0 !important; }',
      'body.brightshore-public-interior > main, body.brightshore-public-interior > div:not(header):not(script):not(style):not(link):not(noscript):first-of-type { position: relative !important; z-index: 1 !important; width: 100% !important; max-width: 100vw !important; overflow-x: hidden !important; margin-top: 0 !important; }',
      'body.brightshore-public-interior .brightshore-public-first-heading-offset { display: block !important; }'
    ];
    var servicingPortalStyles = [
      'html, body { background: #f4f6f8 !important; color: #2f343b !important; text-rendering: optimizeLegibility; }',
      '*, *::before, *::after { box-sizing: border-box !important; }',
      'html, body { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }',
      'body { margin: 0 !important; overflow-x: hidden !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important; }',
      '.wrapper, .main-panel, .ficsBody, .content, .container, .container-fluid { left: 0 !important; right: auto !important; transform: none !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; background: #f4f6f8 !important; }',
      '.content, .container, .container-fluid { padding-left: 12px !important; padding-right: 12px !important; }',
      '.row { margin-left: 0 !important; margin-right: 0 !important; }',
      '[class*="col-"] { padding-left: 0 !important; padding-right: 0 !important; max-width: 100% !important; }',
      '.card, .ficsCard, .main-panel .card { width: 100% !important; max-width: calc(100vw - 24px) !important; margin: 12px auto !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; box-shadow: 0 2px 10px rgba(20, 30, 45, 0.06) !important; overflow: hidden !important; }',
      '.card-header, .ficsCardHeader { background: #fff !important; border-bottom: 1px solid #e6e9ed !important; padding: 16px 18px !important; }',
      '.card-header, .card-header h1, .card-header h2, .card-header h3, .card-header h4, .card-header h5 { color: #2f343b !important; font-size: 14px !important; font-weight: 700 !important; letter-spacing: 0 !important; line-height: 1.25 !important; }',
      '.card-body, .ficsCardBody, .card .content { position: relative !important; left: 0 !important; transform: none !important; width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; padding: 18px !important; color: #3d434b !important; font-size: 15px !important; line-height: 1.45 !important; }',
      '.card-body, .card-body *, .ficsCardBody, .ficsCardBody *, .modal-body, .modal-body * { max-width: 100% !important; font-size: 14px !important; line-height: 1.45 !important; letter-spacing: 0 !important; white-space: normal !important; overflow-wrap: break-word !important; }',
      '.card-body > *, .ficsCardBody > * { margin-left: 0 !important; margin-right: 0 !important; }',
      '.card-body > p, .card-body > div:not(.table-responsive):not(.dataTables_wrapper), .ficsCardBody > p, .ficsCardBody > div:not(.table-responsive):not(.dataTables_wrapper) { padding-left: 10px !important; padding-right: 10px !important; }',
      '.card-body p, .ficsCardBody p, .modal-body p { margin: 0 0 12px !important; }',
      '.card-body strong, .card-body b, .ficsCardBody strong, .ficsCardBody b, .modal-body strong, .modal-body b { display: block !important; margin: 14px 0 4px !important; color: #20242a !important; font-size: 14px !important; font-weight: 700 !important; line-height: 1.25 !important; }',
      '.card-body strong:first-child, .card-body b:first-child, .ficsCardBody strong:first-child, .ficsCardBody b:first-child, .modal-body strong:first-child, .modal-body b:first-child { margin-top: 0 !important; }',
      '.card-body a, .ficsCardBody a, .modal-body a { color: #2357c6 !important; font-weight: 600 !important; overflow-wrap: anywhere !important; word-break: break-word !important; }',
      '.card-body br + br, .ficsCardBody br + br, .modal-body br + br { display: none !important; }',
      '.navbar, .navbar-nav, .nav, .dropdown, .nav-item.dropdown { overflow: visible !important; }',
      '.dropdown-menu { z-index: 2147482000 !important; max-width: min(92vw, 360px) !important; white-space: normal !important; overflow: visible !important; background: #fff !important; border: 1px solid #e0e4ea !important; border-radius: 8px !important; box-shadow: 0 12px 30px rgba(20, 30, 45, 0.18) !important; padding: 8px 0 !important; }',
      '.dropdown-menu.show, .dropdown-menu.brightshore-dropdown-open, .dropdown.show > .dropdown-menu, .nav-item.show > .dropdown-menu { display: block !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }',
      '.dropdown-menu.brightshore-dropdown-inline { position: static !important; float: none !important; width: calc(100% - 28px) !important; max-width: calc(100% - 28px) !important; margin: 10px 14px 18px !important; transform: none !important; box-shadow: 0 8px 18px rgba(20, 30, 45, 0.08) !important; }',
      '.dropdown-menu.brightshore-dropdown-fixed { position: fixed !important; right: auto !important; bottom: auto !important; transform: none !important; z-index: 2147483000 !important; min-width: 320px !important; }',
      '.dropdown-menu.brightshore-dropdown-fixed::before, .dropdown-menu.brightshore-dropdown-fixed::after { left: var(--brightshore-dropdown-arrow-left, 32px) !important; right: auto !important; transform: translateX(-50%) !important; }',
      '.dropdown-menu > .dropdown-item, .dropdown-menu > a { display: grid !important; grid-template-columns: 40px minmax(0, 1fr) !important; column-gap: 12px !important; align-items: center !important; padding: 12px 18px !important; color: #3d434b !important; white-space: normal !important; line-height: 1.22 !important; text-decoration: none !important; text-align: left !important; }',
      '.dropdown-menu > .dropdown-item > i, .dropdown-menu > a > i, .dropdown-menu > .dropdown-item > svg, .dropdown-menu > a > svg, .dropdown-menu > .dropdown-item > span:first-child, .dropdown-menu > a > span:first-child { grid-column: 1 !important; justify-self: center !important; max-width: 32px !important; }',
      '.dropdown-menu.brightshore-dropdown-inline > .dropdown-item, .dropdown-menu.brightshore-dropdown-inline > a { grid-template-columns: 44px minmax(0, 1fr) !important; column-gap: 14px !important; padding: 14px 20px !important; font-size: 21px !important; }',
      '.dropdown-menu.brightshore-dropdown-fixed > .dropdown-item, .dropdown-menu.brightshore-dropdown-fixed > a { grid-template-columns: 38px minmax(0, 1fr) !important; font-size: 16px !important; }',
      '.table-responsive, .dataTables_wrapper { width: 100% !important; max-width: 100% !important; overflow-x: auto !important; overflow-y: visible !important; -webkit-overflow-scrolling: touch !important; }',
      '.dataTables_wrapper .row, .dataTables_wrapper [class*="col-"] { display: block !important; width: 100% !important; max-width: 100% !important; }',
      '.dataTables_length, .dataTables_filter, .dataTables_info, .dataTables_paginate { width: 100% !important; margin: 8px 0 !important; text-align: left !important; font-size: 13px !important; }',
      '.dataTables_filter label, .dataTables_length label { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; margin: 0 !important; font-weight: 600 !important; color: #303741 !important; }',
      '.dataTables_filter input, .dataTables_length select, .card-body input, .card-body select, .ficsCardBody input, .ficsCardBody select { min-height: 38px !important; border: 1px solid #cfd6df !important; border-radius: 6px !important; padding: 8px 10px !important; background: #fff !important; color: #252b33 !important; font-size: 14px !important; }',
      '.dataTables_filter input { flex: 1 1 180px !important; min-width: 0 !important; }',
      '.dataTables_wrapper table, table.dataTable { min-width: 560px !important; table-layout: auto !important; }',
      '.card-body table, .ficsCardBody table { width: 100% !important; min-width: 0 !important; border-collapse: separate !important; border-spacing: 0 !important; table-layout: fixed !important; font-size: 14px !important; }',
      '.card-body th, .card-body td, .ficsCardBody th, .ficsCardBody td { padding: 12px 10px !important; vertical-align: middle !important; line-height: 1.35 !important; word-break: normal !important; overflow-wrap: anywhere !important; }',
      '.card-body th, .ficsCardBody th { background: #f8fafc !important; color: #1f2730 !important; font-weight: 700 !important; border-bottom: 1px solid #d8dde4 !important; }',
      '.card-body table:not(.dataTable) td:first-child, .ficsCardBody table:not(.dataTable) td:first-child { width: 46% !important; color: #5b6470 !important; font-weight: 600 !important; text-align: left !important; }',
      '.card-body table:not(.dataTable) td:last-child, .ficsCardBody table:not(.dataTable) td:last-child { width: 54% !important; color: #252b33 !important; text-align: right !important; }',
      '.dataTables_wrapper td:nth-child(1), table.dataTable td:nth-child(1) { width: 54px !important; text-align: center !important; }',
      '.dataTables_wrapper td:nth-child(2), table.dataTable td:nth-child(2) { min-width: 96px !important; white-space: nowrap !important; }',
      '.dataTables_wrapper td:nth-child(3), table.dataTable td:nth-child(3) { min-width: 190px !important; }',
      '.dataTables_wrapper td:last-child, table.dataTable td:last-child { min-width: 92px !important; text-align: center !important; }',
      'body.brightshore-page-dashboard .card-body, body.brightshore-page-dashboard .ficsCardBody { padding-left: 24px !important; padding-right: 18px !important; }',
      'body.brightshore-page-dashboard .card-body > *, body.brightshore-page-dashboard .ficsCardBody > * { position: static !important; left: auto !important; transform: none !important; margin-left: 0 !important; padding-left: 0 !important; }',
      'body.brightshore-page-dashboard .card-body > div, body.brightshore-page-dashboard .ficsCardBody > div, body.brightshore-page-dashboard .card-body .row, body.brightshore-page-dashboard .ficsCardBody .row { width: 100% !important; max-width: 100% !important; margin-left: auto !important; margin-right: auto !important; }',
      'body.brightshore-page-dashboard .card-body .card, body.brightshore-page-dashboard .ficsCardBody .card { width: 100% !important; max-width: 100% !important; margin-left: auto !important; margin-right: auto !important; }',
      'body.brightshore-page-dashboard .card-body p, body.brightshore-page-dashboard .ficsCardBody p { padding-left: 0 !important; text-indent: 0 !important; margin-left: 0 !important; }',
      'body.brightshore-page-dashboard .card-body p::first-letter, body.brightshore-page-dashboard .ficsCardBody p::first-letter { margin-left: 0 !important; }',
      '@media (max-width: 991.98px) { body.brightshore-page-dashboard .d-none.d-lg-block, body.brightshore-page-dashboard .d-none.d-lg-flex, body.brightshore-page-dashboard .col-6.d-none { display: none !important; visibility: hidden !important; } body.brightshore-page-dashboard .d-block.d-lg-none, body.brightshore-page-dashboard .col-12.d-block.d-lg-none { display: block !important; visibility: visible !important; width: 100% !important; max-width: 100% !important; flex: 0 0 100% !important; } }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table { display: none !important; }',
      'body.brightshore-page-dashboard .brightshore-dashboard-payment-list { display: grid !important; width: 100% !important; gap: 8px !important; margin-top: 8px !important; }',
      'body.brightshore-page-dashboard .brightshore-dashboard-payment-item { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; grid-template-areas: "dates amount" !important; gap: 10px !important; align-items: center !important; width: 100% !important; padding: 12px !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; }',
      'body.brightshore-page-dashboard .brightshore-dashboard-payment-dates { grid-area: dates !important; min-width: 0 !important; color: #66707c !important; font-size: 12px !important; line-height: 1.35 !important; text-align: left !important; }',
      'body.brightshore-page-dashboard .brightshore-dashboard-payment-dates span { display: block !important; white-space: nowrap !important; }',
      'body.brightshore-page-dashboard .brightshore-dashboard-payment-dates strong { display: inline !important; margin: 0 !important; color: #66707c !important; font-size: 12px !important; font-weight: 800 !important; }',
      'body.brightshore-page-dashboard .brightshore-dashboard-payment-amount { grid-area: amount !important; color: #252b33 !important; font-size: 16px !important; font-weight: 800 !important; text-align: right !important; white-space: nowrap !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table thead { display: none !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table tbody { display: grid !important; gap: 8px !important; width: 100% !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table tr { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: "amount" "due" "paid" !important; gap: 5px !important; align-items: start !important; width: 100% !important; padding: 12px !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td { display: block !important; width: 100% !important; min-width: 0 !important; padding: 0 !important; border: 0 !important; justify-self: stretch !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(1), body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(2) { color: #66707c !important; font-size: 12px !important; line-height: 1.3 !important; white-space: nowrap !important; text-align: left !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(1) { grid-area: due !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(2) { grid-area: paid !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(1)::before, body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(2)::before { display: inline !important; background: transparent !important; color: #66707c !important; font-weight: 800 !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(1)::before { content: "Due: " !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(2)::before { content: "Paid: " !important; }',
      'body.brightshore-page-dashboard table.brightshore-dashboard-payment-table td:nth-child(3) { grid-area: amount !important; color: #252b33 !important; font-size: 16px !important; font-weight: 800 !important; text-align: right !important; white-space: nowrap !important; }',
      'body.brightshore-page-dashboard .card:has(table.brightshore-dashboard-payment-table) { overflow: visible !important; }',
      'body.brightshore-page-dashboard .card:has(table.brightshore-dashboard-payment-table) .card-body, body.brightshore-page-dashboard .card:has(table.brightshore-dashboard-payment-table) .ficsCardBody { padding-left: 16px !important; padding-right: 16px !important; }',
      'body.brightshore-page-memo #ResultsGrid { display: block !important; width: 100% !important; min-width: 0 !important; table-layout: auto !important; border: 0 !important; }',
      'body.brightshore-page-memo #ResultsGrid thead { display: none !important; }',
      'body.brightshore-page-memo #ResultsGrid > tbody { display: block !important; width: 100% !important; }',
      'body.brightshore-page-memo #ResultsGrid > tbody > tr:not([id^="row_"]) { display: none !important; }',
      'body.brightshore-page-memo #ResultsGrid > tbody > tr[id^="row_"] { display: grid !important; grid-template-columns: 44px minmax(0, 1fr) auto !important; grid-template-areas: "expand subject print" "expand date print" !important; gap: 6px 10px !important; align-items: center !important; width: 100% !important; min-height: 82px !important; margin: 10px 0 !important; padding: 12px !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; }',
      'body.brightshore-page-memo #ResultsGrid > tbody > tr[id^="row_"] > td { display: none !important; width: auto !important; max-width: 100% !important; min-width: 0 !important; padding: 0 !important; border: 0 !important; text-align: left !important; white-space: normal !important; overflow-wrap: anywhere !important; }',
      'body.brightshore-page-memo #ResultsGrid > tbody > tr[id^="row_"] > td.brightshore-note-mobile { display: block !important; grid-column: 1 / -1 !important; width: 100% !important; max-width: 100% !important; }',
      'body.brightshore-page-memo .brightshore-note-card-row { display: grid !important; grid-template-columns: 44px minmax(0, 1fr) auto !important; grid-template-areas: "expand subject print" "expand date print" !important; gap: 6px 14px !important; align-items: center !important; width: 100% !important; }',
      'body.brightshore-page-memo .brightshore-note-card-expand { grid-area: expand !important; display: flex !important; align-items: center !important; justify-content: center !important; }',
      'body.brightshore-page-memo .brightshore-note-card-subject { grid-area: subject !important; color: #252b33 !important; font-size: 14px !important; font-weight: 700 !important; line-height: 1.25 !important; }',
      'body.brightshore-page-memo .brightshore-note-card-date { grid-area: date !important; color: #66707c !important; font-size: 12px !important; line-height: 1.25 !important; white-space: nowrap !important; }',
      'body.brightshore-page-memo .brightshore-note-card-print { grid-area: print !important; display: flex !important; align-items: center !important; justify-content: flex-end !important; }',
      'body.brightshore-page-memo .brightshore-note-card-body { display: none !important; grid-column: 1 / -1 !important; margin-top: 12px !important; padding-top: 12px !important; border-top: 1px solid #e5e9ef !important; color: #3d434b !important; font-size: 13px !important; line-height: 1.45 !important; white-space: pre-wrap !important; }',
      'body.brightshore-page-memo tr.brightshore-note-expanded .brightshore-note-card-body { display: block !important; }',
      'body.brightshore-page-memo #ResultsGrid .btn, body.brightshore-page-memo #ResultsGrid button, body.brightshore-page-memo #ResultsGrid input[type="button"] { width: auto !important; min-width: 72px !important; padding: 8px 10px !important; font-size: 11px !important; }',
      'body.brightshore-page-memo #ResultsGrid .brightshore-note-card-expand .btn, body.brightshore-page-memo #ResultsGrid .brightshore-note-card-expand button, body.brightshore-page-memo #ResultsGrid .brightshore-note-card-expand input[type="button"], body.brightshore-page-memo #ResultsGrid .brightshore-note-card-expand a { width: 40px !important; min-width: 40px !important; max-width: 40px !important; height: 40px !important; min-height: 40px !important; padding: 0 !important; border-radius: 20px !important; }',
      'body.brightshore-page-memo #ResultsGrid .nc-icon, body.brightshore-page-memo #ResultsGrid i { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 34px !important; height: 34px !important; line-height: 34px !important; }',
      'body.brightshore-page-payment-history #ResultsGrid, body.brightshore-page-documents #ResultsGrid { display: block !important; width: 100% !important; min-width: 0 !important; border: 0 !important; }',
      'body.brightshore-page-payment-history .toolbar { float: none !important; display: block !important; width: 100% !important; margin: 10px 0 8px !important; color: #59616b !important; font-size: 13px !important; line-height: 1.35 !important; text-align: left !important; }',
      'body.brightshore-page-payment-history .ficsSearchClear { display: flex !important; justify-content: center !important; gap: 8px !important; margin: 8px 0 12px !important; }',
      'body.brightshore-page-payment-history .ficsSearchClear .btn { flex: 0 1 120px !important; margin-top: 0 !important; }',
      'body.brightshore-page-payment-history #beginDate, body.brightshore-page-payment-history #endDate { margin: 6px 0 !important; }',
      'body.brightshore-page-payment-history .dataTables_filter { margin-top: 10px !important; }',
      'body.brightshore-page-payment-history .dataTables_filter label, body.brightshore-page-documents .dataTables_filter label { display: block !important; width: 100% !important; }',
      'body.brightshore-page-payment-history .dataTables_filter strong, body.brightshore-page-documents .dataTables_filter strong { display: block !important; margin: 0 0 4px !important; }',
      'body.brightshore-page-payment-history #ResultsGrid thead, body.brightshore-page-documents #ResultsGrid thead { display: none !important; }',
      'body.brightshore-page-payment-history #ResultsGrid > tbody, body.brightshore-page-documents #ResultsGrid > tbody { display: block !important; width: 100% !important; }',
      'body.brightshore-page-payment-history #ResultsGrid > tbody > tr, body.brightshore-page-documents #ResultsGrid > tbody > tr { display: block !important; width: 100% !important; margin: 10px 0 !important; padding: 0 !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; }',
      'body.brightshore-page-payment-history #ResultsGrid > tbody > tr > td:not(.brightshore-payment-mobile), body.brightshore-page-documents #ResultsGrid > tbody > tr > td:not(.brightshore-document-mobile) { display: none !important; }',
      'body.brightshore-page-payment-history #ResultsGrid > tbody > tr > td.brightshore-payment-mobile, body.brightshore-page-documents #ResultsGrid > tbody > tr > td.brightshore-document-mobile { display: block !important; width: 100% !important; padding: 12px !important; border: 0 !important; }',
      'body.brightshore-page-payment-history .brightshore-payment-card { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; grid-template-areas: "desc amount" "dates action" !important; gap: 8px 12px !important; align-items: center !important; }',
      'body.brightshore-page-payment-history .brightshore-payment-desc { grid-area: desc !important; color: #252b33 !important; font-weight: 700 !important; font-size: 14px !important; line-height: 1.25 !important; }',
      'body.brightshore-page-payment-history .brightshore-payment-amount { grid-area: amount !important; color: #252b33 !important; font-weight: 800 !important; font-size: 14px !important; white-space: nowrap !important; text-align: right !important; }',
      'body.brightshore-page-payment-history .brightshore-payment-dates { grid-area: dates !important; color: #66707c !important; font-size: 12px !important; line-height: 1.35 !important; }',
      'body.brightshore-page-payment-history .brightshore-payment-action { grid-area: action !important; display: flex !important; justify-content: flex-end !important; }',
      'body.brightshore-page-payment-history .brightshore-payment-action .btn { min-width: 64px !important; padding: 8px 10px !important; font-size: 11px !important; }',
      'body.brightshore-page-documents .brightshore-document-card { display: grid !important; grid-template-columns: 44px minmax(0, 1fr) auto !important; grid-template-areas: "toggle title count" "body body body" !important; gap: 8px 12px !important; align-items: center !important; }',
      'body.brightshore-page-documents .brightshore-document-toggle { grid-area: toggle !important; display: flex !important; align-items: center !important; justify-content: center !important; }',
      'body.brightshore-page-documents .brightshore-document-title { grid-area: title !important; min-width: 0 !important; color: #2357c6 !important; font-weight: 800 !important; font-size: 14px !important; line-height: 1.25 !important; overflow-wrap: anywhere !important; }',
      'body.brightshore-page-documents .brightshore-document-title a { color: #2357c6 !important; text-decoration: none !important; }',
      'body.brightshore-page-documents .brightshore-document-count { grid-area: count !important; min-width: 30px !important; height: 30px !important; border-radius: 15px !important; display: flex !important; align-items: center !important; justify-content: center !important; background: #eef4f7 !important; color: #59616b !important; font-size: 12px !important; font-weight: 800 !important; }',
      'body.brightshore-page-documents .brightshore-document-body { display: none !important; grid-area: body !important; padding-top: 10px !important; border-top: 1px solid #e5e9ef !important; }',
      'body.brightshore-page-documents tr.brightshore-document-expanded .brightshore-document-body { display: block !important; }',
      'body.brightshore-page-documents .brightshore-document-body a { display: block !important; padding: 9px 0 !important; color: #2357c6 !important; font-size: 13px !important; font-weight: 700 !important; text-decoration: none !important; border-bottom: 1px solid #edf0f3 !important; }',
      'body.brightshore-page-documents .brightshore-document-toggle .btn, body.brightshore-page-documents .brightshore-document-toggle button { width: 40px !important; min-width: 40px !important; max-width: 40px !important; height: 40px !important; min-height: 40px !important; padding: 0 !important; border-radius: 20px !important; }',
      'body.brightshore-page-loan-info .content, body.brightshore-page-loan-info .container, body.brightshore-page-loan-info .container-fluid, body.brightshore-page-account-info .content, body.brightshore-page-account-info .container, body.brightshore-page-account-info .container-fluid, body.brightshore-page-payment-options .content, body.brightshore-page-payment-options .container, body.brightshore-page-payment-options .container-fluid { padding-bottom: 104px !important; }',
      'body.brightshore-page-loan-info footer, body.brightshore-page-loan-info .footer, body.brightshore-page-account-info footer, body.brightshore-page-account-info .footer, body.brightshore-page-payment-options footer, body.brightshore-page-payment-options .footer { display: none !important; }',
      'body.brightshore-page-loan-info .card-body h3, body.brightshore-page-loan-info .ficsCardBody h3 { margin: 18px 0 8px !important; color: #252b33 !important; font-size: 16px !important; font-weight: 800 !important; line-height: 1.25 !important; }',
      'body.brightshore-page-loan-info .customStripedTable { display: block !important; width: 100% !important; margin: 0 0 14px !important; padding-top: 12px !important; border: 1px solid #e0e5eb !important; border-radius: 8px !important; overflow: hidden !important; background: #fff !important; }',
      'body.brightshore-page-loan-info .customStripedTable thead { display: none !important; }',
      'body.brightshore-page-loan-info .customStripedTable tbody { display: block !important; width: 100% !important; padding-top: 12px !important; }',
      'body.brightshore-page-loan-info .customStripedTable tr { display: block !important; width: 100% !important; }',
      'body.brightshore-page-loan-info .customStripedTable tr { padding: 12px 14px !important; border-bottom: 1px solid #edf0f3 !important; }',
      'body.brightshore-page-loan-info .customStripedTable tr:first-child { padding-top: 18px !important; }',
      'body.brightshore-page-loan-info .customStripedTable tr:last-child { border-bottom: 0 !important; }',
      'body.brightshore-page-loan-info .customStripedTable td { display: none !important; padding: 0 !important; border: 0 !important; width: auto !important; text-align: left !important; }',
      'body.brightshore-page-loan-info .customStripedTable td:first-child, body.brightshore-page-loan-info .customStripedTable td.text-right { display: block !important; }',
      'body.brightshore-page-loan-info .customStripedTable td:first-child { margin-bottom: 4px !important; color: #5b6470 !important; font-size: 12px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0 !important; overflow-wrap: normal !important; word-break: normal !important; }',
      'body.brightshore-page-loan-info .customStripedTable td.text-right { color: #252b33 !important; font-size: 15px !important; font-weight: 700 !important; line-height: 1.35 !important; text-align: left !important; overflow-wrap: anywhere !important; }',
      'body.brightshore-page-account-info .customStripedTable { display: block !important; width: 100% !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; background: #f8fafc !important; overflow: visible !important; }',
      'body.brightshore-page-account-info .customStripedTable tbody { display: block !important; width: 100% !important; }',
      'body.brightshore-page-account-info .customStripedTable tr { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; gap: 4px !important; align-items: start !important; width: 100% !important; padding: 11px 12px !important; border: 0 !important; }',
      'body.brightshore-page-account-info .customStripedTable td { display: block !important; width: 100% !important; padding: 0 !important; border: 0 !important; line-height: 1.28 !important; word-break: normal !important; }',
      'body.brightshore-page-account-info .customStripedTable td:first-child { color: #5b6470 !important; font-size: 12px !important; font-weight: 800 !important; text-align: left !important; overflow-wrap: normal !important; white-space: normal !important; }',
      'body.brightshore-page-account-info .customStripedTable td:last-child, body.brightshore-page-account-info .customStripedTable td.text-right { color: #414852 !important; font-size: 13px !important; font-weight: 500 !important; text-align: left !important; overflow-wrap: anywhere !important; white-space: normal !important; }',
      'body.brightshore-page-account-info .ficsChangeAddressEmail, body.brightshore-page-account-info input.ficsChangeAddressEmail { display: block !important; width: 100% !important; max-width: 286px !important; min-height: 36px !important; margin: 14px auto 0 !important; padding: 9px 12px !important; font-size: 12px !important; line-height: 1.2 !important; white-space: nowrap !important; }',
      'body.brightshore-page-payment-options .pageTitle, body.brightshore-page-payment-options .pageTitle p { display: block !important; max-width: 300px !important; margin: 0 auto 12px !important; padding: 0 !important; color: #3d434b !important; font-size: 15px !important; line-height: 1.45 !important; text-align: center !important; }',
      'body.brightshore-page-payment-options .list-group { display: grid !important; gap: 12px !important; width: 100% !important; max-width: 300px !important; padding: 0 !important; margin: 18px auto !important; justify-items: stretch !important; }',
      'body.brightshore-page-payment-options .list-group-item { display: block !important; width: 100% !important; padding: 16px 14px !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; text-align: center !important; }',
      'body.brightshore-page-payment-options .payTypeLinkHeading, body.brightshore-page-payment-options .payTypeLinkSubHeading { display: block !important; margin: 0 auto !important; padding: 0 !important; text-align: center !important; }',
      'body.brightshore-page-payment-options .payTypeLinkHeading a { color: #2357c6 !important; font-size: 15px !important; font-weight: 800 !important; text-decoration: none !important; }',
      'body.brightshore-page-payment-options .payTypeLinkSubHeading { margin-top: 6px !important; color: #59616b !important; font-size: 13px !important; line-height: 1.35 !important; }',
      'body.brightshore-page-payment-options input[hidden] { display: none !important; }',
      '.docLink { color: #2357c6 !important; font-weight: 600 !important; text-decoration: none !important; }',
      '.docLink:focus, .docLink:hover { text-decoration: underline !important; }',
      '.btn, button, input[type="button"], input[type="submit"] { border-radius: 6px !important; min-height: 38px !important; padding: 9px 14px !important; font-size: 13px !important; font-weight: 700 !important; letter-spacing: 0 !important; text-transform: uppercase !important; white-space: normal !important; }',
      '.btn-info, .btn-primary, .btn-success { background: #39b8ce !important; border-color: #39b8ce !important; color: #fff !important; }',
      '.btn-danger, .btn-warning { background: #f25a43 !important; border-color: #f25a43 !important; color: #fff !important; }',
      '.nav-tabs, .nav-pills, .tab-content { width: 100% !important; max-width: 100% !important; }',
      '.nav-tabs, .nav-pills { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0 !important; border: 1px solid #39b8ce !important; border-radius: 7px !important; overflow: hidden !important; }',
      '.nav-tabs .nav-item, .nav-pills .nav-item { width: 100% !important; margin: 0 !important; }',
      '.nav-tabs .nav-link, .nav-pills .nav-link { width: 100% !important; min-height: 56px !important; display: flex !important; align-items: center !important; justify-content: center !important; border: 0 !important; border-radius: 0 !important; padding: 8px !important; color: #289fb7 !important; background: #fff !important; font-size: 12px !important; font-weight: 700 !important; text-align: center !important; line-height: 1.25 !important; }',
      '.nav-tabs .nav-link.active, .nav-pills .nav-link.active, .nav-tabs .nav-item.show .nav-link { background: #39b8ce !important; color: #fff !important; }',
      '.tab-pane, .tab-content .card, .calculator, .amortizationCalculator { width: 100% !important; max-width: 100% !important; }',
      '.card-body .row, .ficsCardBody .row, .card-body .form-row, .ficsCardBody .form-row { display: block !important; width: 100% !important; }',
      '.card-body [class*="col-"], .ficsCardBody [class*="col-"] { display: block !important; width: 100% !important; max-width: 100% !important; flex: 0 0 100% !important; }',
      'body.brightshore-page-dashboard .card-body .row, body.brightshore-page-dashboard .ficsCardBody .row, body.brightshore-page-dashboard .card-body .form-row, body.brightshore-page-dashboard .ficsCardBody .form-row { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }',
      'body.brightshore-page-dashboard .card-body [class*="col-"], body.brightshore-page-dashboard .ficsCardBody [class*="col-"] { width: 100% !important; max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; margin-left: auto !important; margin-right: auto !important; }',
      '.input-group { display: flex !important; align-items: stretch !important; width: 100% !important; max-width: 100% !important; flex-wrap: nowrap !important; }',
      '.input-group-prepend, .input-group-append { display: flex !important; flex: 0 0 auto !important; }',
      '.input-group-text, .input-group-addon { position: static !important; display: flex !important; align-items: center !important; min-width: 36px !important; padding: 8px 10px !important; border: 1px solid #cfd6df !important; background: #eef1f4 !important; color: #59616b !important; transform: none !important; }',
      '.input-group .form-control, .input-group input { flex: 1 1 auto !important; min-width: 0 !important; margin: 0 !important; padding-left: 10px !important; }',
      '.input-group > .input-group-text + input, .input-group > .input-group-addon + input, .input-group > .input-group-prepend + input { border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; }',
      'body.brightshore-page-amortization .input-group-text, body.brightshore-page-amortization .input-group-addon, body.brightshore-page-amortization .input-group-prepend, body.brightshore-page-amortization .input-group-append { display: none !important; }',
      'body.brightshore-page-amortization .input-group::before, body.brightshore-page-amortization .input-group::after, body.brightshore-page-amortization .form-group::before, body.brightshore-page-amortization .form-group::after { content: none !important; display: none !important; }',
      'body.brightshore-page-amortization .input-group:has(input) input, body.brightshore-page-amortization .input-group:has(input) .form-control { border-radius: 6px !important; padding-left: 14px !important; }',
      'body.brightshore-page-amortization input:not([type="range"]) { padding-left: 14px !important; text-indent: 0 !important; }',
      'body.brightshore-page-amortization .input-icon > i.paymentOptions { display: none !important; visibility: hidden !important; }',
      'body.brightshore-page-amortization .brightshore-hidden-currency-symbol { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }',
      'body.brightshore-page-amortization input[name*="Amount" i], body.brightshore-page-amortization input[id*="Amount" i], body.brightshore-page-amortization input[placeholder*="$"] { padding-left: 14px !important; background-image: none !important; }',
      'body.brightshore-page-login .form-group { display: block !important; width: 100% !important; max-width: 100% !important; }',
      'body.brightshore-page-login .form-group > label, body.brightshore-page-login label[for*="User"], body.brightshore-page-login label[for*="user"], body.brightshore-page-login label[for*="Password"], body.brightshore-page-login label[for*="password"] { display: none !important; }',
      'body.brightshore-page-login .input-group { display: flex !important; align-items: stretch !important; width: 100% !important; max-width: 100% !important; flex-wrap: nowrap !important; }',
      'body.brightshore-page-login .input-group-prepend, body.brightshore-page-login .input-group-append, body.brightshore-page-login .input-group-text, body.brightshore-page-login .input-group-addon { display: flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 38px !important; min-width: 38px !important; padding: 0 10px !important; border: 1px solid #cfd6df !important; border-right: 0 !important; background: transparent !important; color: #59616b !important; }',
      'body.brightshore-page-login .input-group .form-control, body.brightshore-page-login .input-group input { flex: 1 1 auto !important; min-width: 0 !important; margin: 0 !important; border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; padding-left: 10px !important; }',
      '.card-body input:not([type="range"]), .card-body select, .ficsCardBody input:not([type="range"]), .ficsCardBody select { display: block !important; width: 100% !important; max-width: 100% !important; margin: 4px 0 0 !important; }',
      '.card-body input[type="range"], .ficsCardBody input[type="range"] { display: block !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; border: 0 !important; background: transparent !important; }',
      '.card-body input[disabled], .ficsCardBody input[disabled], .card-body .disabled, .ficsCardBody .disabled { background: #eef1f4 !important; color: #59616b !important; opacity: 1 !important; }',
      '.card-body label, .ficsCardBody label { display: block !important; margin: 10px 0 4px !important; color: #303741 !important; font-size: 13px !important; font-weight: 600 !important; }',
      '.card-body .form-group, .ficsCardBody .form-group { margin-bottom: 14px !important; }',
      '.modal-content, .swal-modal, .swal2-popup { border-radius: 8px !important; border: 1px solid #dfe3e8 !important; box-shadow: 0 16px 40px rgba(20, 30, 45, 0.22) !important; color: #2f343b !important; }',
      '.modal-header, .swal-title, .swal2-title { border-bottom-color: #e6e9ed !important; color: #20242a !important; font-weight: 700 !important; line-height: 1.25 !important; }',
      '.modal-body, .swal-text, .swal2-html-container { color: #3d434b !important; font-size: 15px !important; line-height: 1.45 !important; text-align: left !important; }',
      '.swal-icon, .swal2-icon { transform: scale(0.72) !important; margin-top: 14px !important; margin-bottom: 8px !important; }',
      '.swal-button, .swal2-confirm, .modal-footer .btn { border-radius: 6px !important; font-weight: 700 !important; padding: 10px 16px !important; }',
      'body.brightshore-page-login .modal, body.brightshore-page-login .modal-backdrop, body.brightshore-page-login .modal-open { max-width: 100% !important; }',
      'body.brightshore-page-login .modal-dialog { width: calc(100vw - 28px) !important; max-width: 520px !important; margin: 14px auto !important; }',
      'body.brightshore-page-login .modal-content { overflow: hidden !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; color: #2f343b !important; box-shadow: 0 18px 44px rgba(20, 30, 45, 0.28) !important; }',
      'body.brightshore-page-login .modal-header { position: relative !important; display: block !important; padding: 22px 42px 16px !important; border-bottom: 1px solid #edf0f3 !important; text-align: center !important; }',
      'body.brightshore-page-login .modal-title, body.brightshore-page-login .modal-header h1, body.brightshore-page-login .modal-header h2, body.brightshore-page-login .modal-header h3, body.brightshore-page-login .modal-header h4, body.brightshore-page-login .modal-header h5 { margin: 0 !important; color: #303741 !important; font-size: 18px !important; font-weight: 500 !important; line-height: 1.35 !important; text-align: center !important; }',
      'body.brightshore-page-login .modal-header .close, body.brightshore-page-login .modal-header button.close { position: absolute !important; top: 8px !important; right: 10px !important; min-height: 32px !important; width: 32px !important; padding: 0 !important; border: 0 !important; background: transparent !important; color: #5f6771 !important; font-size: 18px !important; line-height: 32px !important; opacity: 1 !important; }',
      'body.brightshore-page-login .modal-body { padding: 18px !important; background: #fff !important; color: #3d434b !important; font-size: 14px !important; line-height: 1.45 !important; }',
      'body.brightshore-page-login .modal-body, body.brightshore-page-login .modal-body * { max-width: 100% !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: normal !important; }',
      'body.brightshore-page-login .modal-body > div, body.brightshore-page-login .modal-body .card, body.brightshore-page-login .modal-body .well, body.brightshore-page-login .modal-body .panel { margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }',
      'body.brightshore-page-login .modal-body p { margin: 0 0 12px !important; color: #3d434b !important; font-size: 14px !important; line-height: 1.45 !important; }',
      'body.brightshore-page-login .modal-body a { color: #2357c6 !important; font-weight: 700 !important; text-decoration: none !important; overflow-wrap: anywhere !important; }',
      'body.brightshore-page-login .modal-body textarea, body.brightshore-page-login .modal-body .form-control { display: block !important; width: 100% !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; color: #3d434b !important; box-shadow: none !important; resize: none !important; font-size: 14px !important; line-height: 1.45 !important; }',
      'body.brightshore-modal-clean .modal { padding: 0 14px !important; }',
      'body.brightshore-modal-clean .modal-dialog { width: 100% !important; max-width: 420px !important; margin: 18px auto !important; }',
      'body.brightshore-modal-clean .modal-content { overflow: hidden !important; border: 1px solid #dfe3e8 !important; border-radius: 8px !important; background: #fff !important; color: #2f343b !important; box-shadow: 0 18px 44px rgba(20, 30, 45, 0.28) !important; }',
      'body.brightshore-modal-clean .modal-header { position: relative !important; display: block !important; min-height: 0 !important; padding: 22px 42px 16px !important; border-bottom: 1px solid #edf0f3 !important; background: #fff !important; text-align: center !important; }',
      'body.brightshore-modal-clean .modal-title, body.brightshore-modal-clean .modal-header h1, body.brightshore-modal-clean .modal-header h2, body.brightshore-modal-clean .modal-header h3, body.brightshore-modal-clean .modal-header h4, body.brightshore-modal-clean .modal-header h5 { margin: 0 !important; color: #252b33 !important; font-size: 18px !important; font-weight: 600 !important; line-height: 1.35 !important; text-align: center !important; }',
      'body.brightshore-modal-clean .modal-header .close, body.brightshore-modal-clean .modal-header button.close { position: absolute !important; top: 8px !important; right: 10px !important; width: 32px !important; min-width: 32px !important; height: 32px !important; min-height: 32px !important; padding: 0 !important; border: 0 !important; border-radius: 16px !important; background: transparent !important; color: #66707c !important; font-size: 18px !important; line-height: 32px !important; opacity: 1 !important; }',
      'body.brightshore-modal-clean .modal-body { padding: 18px !important; background: #fff !important; color: #3d434b !important; font-size: 14px !important; line-height: 1.45 !important; }',
      'body.brightshore-modal-clean .modal-body, body.brightshore-modal-clean .modal-body * { max-width: 100% !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: normal !important; }',
      'body.brightshore-modal-clean .modal-body > div, body.brightshore-modal-clean .modal-body .card, body.brightshore-modal-clean .modal-body .well, body.brightshore-modal-clean .modal-body .panel, body.brightshore-modal-clean .modal-body [style*="background"] { margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; }',
      'body.brightshore-modal-clean .modal-body p { margin: 0 0 12px !important; color: #3d434b !important; font-size: 14px !important; line-height: 1.45 !important; }',
      'body.brightshore-modal-clean .modal-body a { color: #2357c6 !important; font-weight: 800 !important; text-decoration: none !important; overflow-wrap: anywhere !important; }',
      'body.brightshore-modal-clean .modal-body textarea, body.brightshore-modal-clean .modal-body .form-control { display: block !important; width: 100% !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; color: #3d434b !important; box-shadow: none !important; resize: none !important; font-size: 14px !important; line-height: 1.45 !important; }',
      'body.brightshore-modal-clean .modal-footer { padding: 12px 18px 18px !important; border-top: 0 !important; background: #fff !important; }',
      '@media (max-width: 520px) { .content, .container, .container-fluid { padding-left: 12px !important; padding-right: 12px !important; } .card-body, .ficsCardBody, .modal-body { padding: 16px !important; font-size: 14px !important; } .card-body strong, .card-body b, .ficsCardBody strong, .ficsCardBody b, .modal-body strong, .modal-body b { font-size: 14px !important; } .card-header, .ficsCardHeader { padding: 14px 16px !important; } }'
    ];

    if (isPublicMortgageHost) {
      sharedStyles.push.apply(sharedStyles, publicMortgageStyles);
      sharedStyles.push.apply(sharedStyles, publicMortgageInteriorStyles);
    }

    if (isConfiguredEStatusHost) {
      sharedStyles.push.apply(sharedStyles, servicingPortalStyles);
    }

    style.innerHTML = sharedStyles.join('\\n');
    var existingStyle = document.getElementById(style.id);
    if (existingStyle && existingStyle.parentNode) {
      existingStyle.parentNode.removeChild(existingStyle);
    }
    appendToDocumentHead(style);

    if (isConfiguredEStatusHost || isPublicMortgageHost) {
      var viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        headElement.appendChild(viewport);
      }
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
    }

    if (isPublicMortgageHost) {
      function getPublicMortgagePath() {
        return window.location.pathname.replace(/\\/+$/, '');
      }

      var publicFirstHeading = null;
      var publicRouteSyncQueued = false;

      function queuePublicMortgageRouteSync() {
        if (publicRouteSyncQueued) {
          return;
        }

        publicRouteSyncQueued = true;
        setTimeout(function() {
          publicRouteSyncQueued = false;
          syncPublicMortgageRoute();
        }, 120);
      }

      function setBodyClass(name, enabled) {
        if (document.body.classList.contains(name) !== enabled) {
          document.body.classList.toggle(name, enabled);
        }
      }

      function clearPublicHeadingOffset() {
        if (publicFirstHeading) {
          publicFirstHeading.classList.remove('brightshore-public-first-heading-offset');
          publicFirstHeading.style.removeProperty('margin-top');
          publicFirstHeading = null;
        }
      }

      function syncPublicMortgageRoute() {
        if (!document.body) {
          return;
        }

        var publicMortgagePath = getPublicMortgagePath();
        var isPublicMortgageHome = publicMortgagePath === '' || publicMortgagePath === '/';
        var isPublicMortgageInterior = !isPublicMortgageHome;

        setBodyClass('brightshore-public-home', isPublicMortgageHome);
        setBodyClass('brightshore-public-interior', isPublicMortgageInterior);

        if (!isPublicMortgageInterior) {
          if (document.body.style.getPropertyValue('--brightshore-public-header-offset')) {
            document.body.style.removeProperty('--brightshore-public-header-offset');
          }
          clearPublicHeadingOffset();
          return;
        }

        var header = document.querySelector('body > header') || document.querySelector('header');
        if (!header) {
          if (document.body.style.getPropertyValue('--brightshore-public-header-offset') !== '96px') {
            document.body.style.setProperty('--brightshore-public-header-offset', '96px');
          }
          return;
        }

        var rect = header.getBoundingClientRect();
        var offset = Math.max(88, Math.ceil(rect.height || 0));
        var offsetValue = offset + 'px';
        if (document.body.style.getPropertyValue('--brightshore-public-header-offset') !== offsetValue) {
          document.body.style.setProperty('--brightshore-public-header-offset', offsetValue);
        }

        var main = document.querySelector('main') || document.body;
        var headings = Array.from(main.querySelectorAll('h1, [role="heading"]'));
        var firstHeading = headings.find(function(heading) {
          var headingRect = heading.getBoundingClientRect();
          var text = (heading.textContent || '').replace(/\s+/g, ' ').trim();
          return text && headingRect.width > 0 && headingRect.height > 0;
        });

        if (!firstHeading) {
          clearPublicHeadingOffset();
          return;
        }

        if (publicFirstHeading && publicFirstHeading !== firstHeading) {
          clearPublicHeadingOffset();
        }

        publicFirstHeading = firstHeading;

        if (!firstHeading.classList.contains('brightshore-public-first-heading-offset')) {
          firstHeading.classList.add('brightshore-public-first-heading-offset');
        }

        var headerBottom = Math.ceil(rect.bottom || offset);
        var headingTop = Math.floor(firstHeading.getBoundingClientRect().top);
        var currentMargin = parseFloat(window.getComputedStyle(firstHeading).marginTop) || 0;
        var neededOffset = Math.max(0, Math.ceil(currentMargin + headerBottom - headingTop + 16));

        if (neededOffset > 0) {
          var neededValue = neededOffset + 'px';
          if (firstHeading.style.getPropertyValue('margin-top') !== neededValue) {
            firstHeading.style.setProperty('margin-top', neededValue, 'important');
          }
        } else if (firstHeading.style.getPropertyValue('margin-top')) {
          firstHeading.style.removeProperty('margin-top');
        }
      }

      syncPublicMortgageRoute();
      document.addEventListener('DOMContentLoaded', queuePublicMortgageRouteSync);
      window.addEventListener('load', queuePublicMortgageRouteSync);
      window.addEventListener('resize', queuePublicMortgageRouteSync);
      window.addEventListener('popstate', queuePublicMortgageRouteSync);
      setTimeout(syncPublicMortgageRoute, 250);
      setTimeout(syncPublicMortgageRoute, 1000);
      setTimeout(syncPublicMortgageRoute, 2000);

      var originalPublicPushState = window.history.pushState;
      var originalPublicReplaceState = window.history.replaceState;
      window.history.pushState = function() {
        var result = originalPublicPushState.apply(this, arguments);
        queuePublicMortgageRouteSync();
        setTimeout(syncPublicMortgageRoute, 250);
        setTimeout(syncPublicMortgageRoute, 1000);
        return result;
      };
      window.history.replaceState = function() {
        var result = originalPublicReplaceState.apply(this, arguments);
        queuePublicMortgageRouteSync();
        setTimeout(syncPublicMortgageRoute, 250);
        setTimeout(syncPublicMortgageRoute, 1000);
        return result;
      };
    }

    if (isConfiguredEStatusHost) {

      function applyServicingPageClass() {
        if (!document.body) {
          return;
        }

        const path = window.location.pathname.toLowerCase();
        const isRoot = path === '/' || path === '';
        const rootText = isRoot ? (document.body.textContent || '').replace(/\s+/g, ' ').toLowerCase() : '';
        const isAuthenticatedDashboard = isRoot && rootText.indexOf('loan number:') >= 0;
        const hasLoginForm = !!document.querySelector('input[type="password"]') &&
          Array.from(document.querySelectorAll('input')).some(function(input) {
            const hints = [
              input.name || '',
              input.id || '',
              input.autocomplete || '',
              input.placeholder || ''
            ].join(' ').toLowerCase();
            return hints.indexOf('user') >= 0 || hints.indexOf('email') >= 0 || hints.indexOf('login') >= 0;
          });
        const isLoginPage = path.indexOf('/user/login') === 0 || hasLoginForm;
        document.body.classList.toggle('brightshore-page-dashboard', isAuthenticatedDashboard);
        document.body.classList.toggle('brightshore-page-public-home', isRoot && !isAuthenticatedDashboard && !isLoginPage);
        document.body.classList.toggle('brightshore-page-login', isLoginPage);
        document.body.classList.toggle('brightshore-page-memo', path.indexOf('/memo') === 0);
        document.body.classList.toggle('brightshore-page-payment-history', path.indexOf('/history/payment') === 0);
        document.body.classList.toggle('brightshore-page-payment-options', path.indexOf('/paymentoptions') === 0);
        document.body.classList.toggle('brightshore-page-loan-info', path.indexOf('/payment/info') === 0);
        document.body.classList.toggle('brightshore-page-account-info', path.indexOf('/accountinformation') === 0);
        document.body.classList.toggle('brightshore-page-documents', path.indexOf('/documents') === 0);
        document.body.classList.toggle('brightshore-page-amortization', path.indexOf('/calculator') === 0 || path.indexOf('amort') >= 0);
      }

      function normalizeCurrencyInputs() {
        if (!document.body) {
          return;
        }

        if (!document.body.classList.contains('brightshore-page-amortization')) {
          return;
        }

        function stripCurrencyPrefix(value) {
          if (typeof value !== 'string') {
            return value;
          }

          var stripped = value.replace(/^\\s*\\$\\s*/, '');
          return stripped.indexOf('.') === 0 ? '0' + stripped : stripped;
        }

        Array.from(document.querySelectorAll('input')).forEach(function(input) {
          if (input.type === 'range' || input.type === 'button' || input.type === 'submit') {
            return;
          }

          var inputText = [
            input.id || '',
            input.name || '',
            input.placeholder || '',
            input.getAttribute('aria-label') || ''
          ].join(' ').toLowerCase();
          var parent = input.parentElement;

          var value = typeof input.value === 'string' ? input.value : '';
          var looksLikeMoney = inputText.indexOf('amount') >= 0 || /^\\s*\\$/.test(value) || input.placeholder.indexOf('$') >= 0;

          if (!looksLikeMoney || !parent) {
            return;
          }

          var nextValue = stripCurrencyPrefix(value);
          if (nextValue !== value) {
            input.value = nextValue;
            input.setAttribute('value', nextValue);
          }

          input.style.paddingLeft = '14px';
          input.style.textIndent = '0';
          input.style.backgroundImage = 'none';

          var wrappers = [parent, parent.parentElement, parent.parentElement ? parent.parentElement.parentElement : null].filter(Boolean);
          Array.from(parent.querySelectorAll('i.paymentOptions')).forEach(function(element) {
            if ((element.textContent || '').trim() === '$') {
              element.classList.add('brightshore-hidden-currency-symbol');
              element.style.display = 'none';
              element.style.visibility = 'hidden';
            }
          });

          wrappers.forEach(function(wrapper) {
            Array.from(wrapper.children).forEach(function(child) {
              if (child === input || child.contains(input)) {
                return;
              }

              var text = (child.textContent || '').trim();
              var className = typeof child.className === 'string' ? child.className : '';
              var isCurrencyAdornment = text === '$' || /^[$\s]+$/.test(text) || /currency|dollar|prefix|addon|prepend|input-group-(text|addon|prepend|append)/i.test(className);

              if (isCurrencyAdornment) {
                child.classList.add('brightshore-hidden-currency-symbol');
                child.style.display = 'none';
                child.style.visibility = 'hidden';
              }
            });
          });

          wrappers.forEach(function(wrapper) {
            Array.from(wrapper.childNodes).forEach(function(node) {
              if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim() === '$') {
                node.textContent = '';
              }
            });
          });

          Array.from(parent.querySelectorAll('span, i, b, em, label, div')).forEach(function(element) {
            if (element === input || element.contains(input)) {
              return;
            }

            var rect = element.getBoundingClientRect();
            var inputRect = input.getBoundingClientRect();
            var text = (element.textContent || '').trim();
            var overlapsInput = rect.right >= inputRect.left - 4 && rect.left <= inputRect.left + 44 && rect.bottom >= inputRect.top && rect.top <= inputRect.bottom;

            if ((text === '$' || /^[$\s]+$/.test(text)) && overlapsInput) {
              element.classList.add('brightshore-hidden-currency-symbol');
              element.style.display = 'none';
              element.style.visibility = 'hidden';
            }
          });
        });
      }

      function normalizeAccountNotes() {
        if (!document.body) {
          return;
        }

        if (!document.body.classList.contains('brightshore-page-memo')) {
          return;
        }

        Array.from(document.querySelectorAll('#ResultsGrid table .brightshore-note-mobile')).forEach(function(cell) {
          cell.remove();
        });

        var rows = Array.from(document.querySelectorAll('#ResultsGrid > tbody > tr[id^="row_"]'));
        rows.forEach(function(row) {
          var rowId = (row.id || '').replace(/^row_/, '');
          var existingExpandControl = rowId
            ? row.querySelector('#button_' + rowId + ', button[onclick*="showHide"], input[onclick*="showHide"], a[onclick*="showHide"]')
            : row.querySelector('button[onclick*="showHide"], input[onclick*="showHide"], a[onclick*="showHide"]');
          var existingPrintControl = rowId
            ? row.querySelector('#print_' + rowId + ', button[onclick*="printMemo"], input[onclick*="printMemo"], a[onclick*="printMemo"]')
            : row.querySelector('button[onclick*="printMemo"], input[onclick*="printMemo"], a[onclick*="printMemo"]');

          var mobileCells = Array.from(row.children).filter(function(cell) {
            return cell.classList && cell.classList.contains('brightshore-note-mobile');
          });
          var reusableMobileCell = mobileCells[0] || null;

          mobileCells.slice(1).forEach(function(cell) {
            if (cell.classList && cell.classList.contains('brightshore-note-mobile')) {
              cell.remove();
            }
          });

          var cells = Array.from(row.children).filter(function(cell) {
            return cell && cell.tagName && cell.tagName.toLowerCase() === 'td' && !cell.classList.contains('brightshore-note-mobile');
          });

          cells.forEach(function(cell) {
            cell.classList.remove('brightshore-note-expand', 'brightshore-note-date', 'brightshore-note-subject', 'brightshore-note-print');
          });

          var subjectFromData = (row.getAttribute('data-subject') || '').replace(/\\s+/g, ' ').trim();
          var dateFromData = (row.getAttribute('data-createdate') || '').match(/\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/);
          var bodyFromData = (row.getAttribute('data-body') || '').trim();
          var visibleCells = cells.map(function(cell, index) {
            var text = (cell.textContent || '').replace(/\\s+/g, ' ').trim();
            return { cell: cell, index: index, text: text };
          });

          var expand = visibleCells.find(function(item) {
            return item.cell.querySelector('.nc-simple-add, .fa-plus, [class*="add"], [class*="plus"]');
          }) || visibleCells[0];
          var date = visibleCells.find(function(item) {
            return /\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/.test(item.text);
          });
          var print = visibleCells.find(function(item) {
            return item !== expand && /\\bprint\\b/i.test(item.text);
          }) || visibleCells.find(function(item) {
            return item !== expand && item.cell.querySelector('button, input[type="button"], .btn');
          });
          var subject = visibleCells
            .filter(function(item) {
              return item !== expand && item !== date && item !== print && item.text.length > 0;
            })
            .sort(function(a, b) {
              return b.text.length - a.text.length;
            })[0];

          if (expand && expand.cell) {
            expand.cell.classList.add('brightshore-note-expand');
          }

          if (date && date.cell) {
            date.cell.classList.add('brightshore-note-date');
          }

          if (print && print.cell) {
            print.cell.classList.add('brightshore-note-print');
          }

          if (subject && subject.cell) {
            subject.cell.classList.add('brightshore-note-subject');
          }

          var mobileCell = reusableMobileCell || document.createElement('td');
          mobileCell.className = 'brightshore-note-mobile';
          mobileCell.setAttribute('colspan', String(Math.max(cells.length, 1)));

          if (!reusableMobileCell) {
            row.appendChild(mobileCell);
          }

          if (!mobileCell.firstElementChild) {
            var mobileRow = document.createElement('div');
            var expandSlot = document.createElement('div');
            var subjectSlot = document.createElement('div');
            var dateSlot = document.createElement('div');
            var printSlot = document.createElement('div');
            var bodySlot = document.createElement('div');

            mobileRow.className = 'brightshore-note-card-row';
            expandSlot.className = 'brightshore-note-card-expand';
            subjectSlot.className = 'brightshore-note-card-subject';
            dateSlot.className = 'brightshore-note-card-date';
            printSlot.className = 'brightshore-note-card-print';
            bodySlot.className = 'brightshore-note-card-body';

            mobileRow.appendChild(expandSlot);
            mobileRow.appendChild(subjectSlot);
            mobileRow.appendChild(dateSlot);
            mobileRow.appendChild(printSlot);
            mobileRow.appendChild(bodySlot);
            mobileCell.appendChild(mobileRow);
          }

          var expandSlot = mobileCell.querySelector('.brightshore-note-card-expand');
          var subjectSlot = mobileCell.querySelector('.brightshore-note-card-subject');
          var dateSlot = mobileCell.querySelector('.brightshore-note-card-date');
          var printSlot = mobileCell.querySelector('.brightshore-note-card-print');
          var bodySlot = mobileCell.querySelector('.brightshore-note-card-body');
          var expandControl = existingExpandControl || (expand && expand.cell ? expand.cell.querySelector('button, input[type="button"], a, .btn') : null);
          var printControl = existingPrintControl || (print && print.cell ? print.cell.querySelector('button, input[type="button"], a, .btn') : null);

          if (expandSlot && expandControl && !expandSlot.contains(expandControl)) {
            expandSlot.textContent = '';
            expandSlot.appendChild(expandControl);
          }

          if (expandControl && !expandControl.dataset.brightshoreNoteToggleReady) {
            expandControl.dataset.brightshoreNoteToggleReady = 'true';
            expandControl.setAttribute('aria-expanded', row.classList.contains('brightshore-note-expanded') ? 'true' : 'false');
            expandControl.onclick = function(event) {
              event.preventDefault();
              event.stopPropagation();
              var isExpanded = row.classList.toggle('brightshore-note-expanded');
              expandControl.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
              var icon = expandControl.querySelector('i');
              if (icon) {
                icon.classList.toggle('nc-simple-add', !isExpanded);
                icon.classList.toggle('nc-simple-delete', isExpanded);
              }
              return false;
            };
          }

          if (subjectSlot) {
            var subjectText = subject && subject.text ? subject.text.replace(/\\s+/g, ' ').trim() : '';
            subjectSlot.textContent = subjectFromData || subjectText.replace(/Managing your mortgage payments.*$/i, '').trim() || subjectText;
          }

          if (dateSlot) {
            var match = date && date.text ? date.text.match(/\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/) : null;
            dateSlot.textContent = dateFromData ? dateFromData[0] : (match ? match[0] : (date ? date.text : ''));
          }

          if (printSlot && printControl && printControl !== expandControl && !printSlot.contains(printControl)) {
            printSlot.textContent = '';
            printSlot.appendChild(printControl);
          }

          if (bodySlot) {
            bodySlot.textContent = bodyFromData;
          }
        });
      }

      function normalizePaymentHistory() {
        if (!document.body) {
          return;
        }

        if (!document.body.classList.contains('brightshore-page-payment-history')) {
          return;
        }

        function formatPaymentAmount(value) {
          var text = (value || '').replace(/\\s+/g, ' ').trim();
          if (!text || text.indexOf('$') >= 0) {
            return text;
          }

          var numeric = Number(text.replace(/,/g, ''));
          if (!Number.isFinite(numeric)) {
            return text;
          }

          var formatted = Math.abs(numeric).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          return numeric < 0 ? '-$' + formatted : '$' + formatted;
        }

        Array.from(document.querySelectorAll('#ResultsGrid > tbody > tr[id^="row_"]')).forEach(function(row) {
          var existingMobile = row.querySelector(':scope > td.brightshore-payment-mobile');
          var cells = Array.from(row.children).filter(function(cell) {
            return cell && cell.tagName && cell.tagName.toLowerCase() === 'td' && !cell.classList.contains('brightshore-payment-mobile');
          });

          var actionControl = row.querySelector('button[onclick*="ViewDetail"], input[onclick*="ViewDetail"], a[onclick*="ViewDetail"], .ficsView');
          var dueDate = cells[1] ? (cells[1].textContent || '').replace(/\\s+/g, ' ').trim() : '';
          var paidDate = cells[2] ? (cells[2].textContent || '').replace(/\\s+/g, ' ').trim() : '';
          var amount = formatPaymentAmount(cells[3] ? (cells[3].textContent || '').replace(/\\s+/g, ' ').trim() : '');
          var description = cells[4] ? (cells[4].textContent || '').replace(/\\s+/g, ' ').trim() : '';

          var mobileCell = existingMobile || document.createElement('td');
          mobileCell.className = 'brightshore-payment-mobile';
          mobileCell.setAttribute('colspan', String(Math.max(cells.length, 1)));

          if (!existingMobile) {
            row.appendChild(mobileCell);
          }

          if (!mobileCell.firstElementChild) {
            var card = document.createElement('div');
            var descSlot = document.createElement('div');
            var amountSlot = document.createElement('div');
            var datesSlot = document.createElement('div');
            var actionSlot = document.createElement('div');

            card.className = 'brightshore-payment-card';
            descSlot.className = 'brightshore-payment-desc';
            amountSlot.className = 'brightshore-payment-amount';
            datesSlot.className = 'brightshore-payment-dates';
            actionSlot.className = 'brightshore-payment-action';

            card.appendChild(descSlot);
            card.appendChild(amountSlot);
            card.appendChild(datesSlot);
            card.appendChild(actionSlot);
            mobileCell.appendChild(card);
          }

          var descSlot = mobileCell.querySelector('.brightshore-payment-desc');
          var amountSlot = mobileCell.querySelector('.brightshore-payment-amount');
          var datesSlot = mobileCell.querySelector('.brightshore-payment-dates');
          var actionSlot = mobileCell.querySelector('.brightshore-payment-action');

          if (descSlot) {
            descSlot.textContent = description || 'Payment';
          }

          if (amountSlot) {
            amountSlot.textContent = amount;
          }

          if (datesSlot) {
            datesSlot.textContent = 'Due ' + dueDate + (paidDate ? ' · Paid ' + paidDate : '');
          }

          if (actionSlot && actionControl && !actionSlot.contains(actionControl)) {
            actionSlot.textContent = '';
            actionSlot.appendChild(actionControl);
          }
        });
      }

      function normalizeDashboardPayments() {
        if (!document.body) {
          return;
        }

        if (!document.body.classList.contains('brightshore-page-dashboard')) {
          return;
        }

        Array.from(document.querySelectorAll('.card-body .row, .ficsCardBody .row')).forEach(function(row) {
          row.style.setProperty('margin-left', '0', 'important');
          row.style.setProperty('margin-right', '0', 'important');
          row.style.setProperty('padding-left', '0', 'important');
          row.style.setProperty('padding-right', '0', 'important');
          row.style.setProperty('width', '100%', 'important');
          row.style.setProperty('max-width', '100%', 'important');
        });

        Array.from(document.querySelectorAll('.card-body [class*="col-"], .ficsCardBody [class*="col-"]')).forEach(function(column) {
          column.style.setProperty('padding-left', '0', 'important');
          column.style.setProperty('padding-right', '0', 'important');
          column.style.setProperty('margin-left', 'auto', 'important');
          column.style.setProperty('margin-right', 'auto', 'important');
          column.style.setProperty('width', '100%', 'important');
          column.style.setProperty('max-width', '100%', 'important');
        });

        var seenDashboardCards = {};
        Array.from(document.querySelectorAll('.card.col-12')).forEach(function(card) {
          var text = (card.textContent || '').replace(/\\s+/g, ' ').trim();

          if (!text) {
            card.style.display = 'none';
            return;
          }

          var key = text.indexOf('Payment Information') === 0
            ? 'payment'
            : (text.indexOf('Documents') === 0 ? 'documents' : '');

          if (!key) {
            return;
          }

          var parentIsHidden = card.parentElement && window.getComputedStyle(card.parentElement).display === 'none';

          if (seenDashboardCards[key] && !parentIsHidden) {
            card.style.display = 'none';
            return;
          }

          if (!parentIsHidden) {
            seenDashboardCards[key] = true;
            card.style.display = '';
          }
        });

        Array.from(document.querySelectorAll('table.col-12')).forEach(function(table) {
          var headerText = table.tHead ? (table.tHead.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase() : '';

          if (headerText.indexOf('due date') < 0 || headerText.indexOf('paid date') < 0 || headerText.indexOf('payment amount') < 0) {
            return;
          }

          table.classList.add('brightshore-dashboard-payment-table');

          var list = table.nextElementSibling && table.nextElementSibling.classList && table.nextElementSibling.classList.contains('brightshore-dashboard-payment-list')
            ? table.nextElementSibling
            : null;

          if (!list) {
            list = document.createElement('div');
            list.className = 'brightshore-dashboard-payment-list';
            table.parentNode.insertBefore(list, table.nextSibling);
          }

          var rows = Array.from(table.querySelectorAll('tbody tr'));
          list.innerHTML = '';
          rows.forEach(function(row) {
            var cells = Array.from(row.children).map(function(cell) {
              return (cell.textContent || '').replace(/\\s+/g, ' ').trim();
            });

            if (cells.length < 3 || !cells[0] || !cells[2]) {
              return;
            }

            var item = document.createElement('div');
            var dates = document.createElement('div');
            var due = document.createElement('span');
            var paid = document.createElement('span');
            var amount = document.createElement('div');

            item.className = 'brightshore-dashboard-payment-item';
            dates.className = 'brightshore-dashboard-payment-dates';
            amount.className = 'brightshore-dashboard-payment-amount';

            due.innerHTML = '<strong>Due:</strong> ' + cells[0];
            paid.innerHTML = '<strong>Paid:</strong> ' + cells[1];
            amount.textContent = cells[2];

            dates.appendChild(due);
            dates.appendChild(paid);
            item.appendChild(dates);
            item.appendChild(amount);
            list.appendChild(item);
          });
        });
      }

      function normalizeDocuments() {
        if (!document.body) {
          return;
        }

        if (!document.body.classList.contains('brightshore-page-documents')) {
          return;
        }

        Array.from(document.querySelectorAll('#ResultsGrid > tbody > tr')).forEach(function(row, index) {
          var existingMobile = row.querySelector(':scope > td.brightshore-document-mobile');
          var cells = Array.from(row.children).filter(function(cell) {
            return cell && cell.tagName && cell.tagName.toLowerCase() === 'td' && !cell.classList.contains('brightshore-document-mobile');
          });

          if (cells.length < 2) {
            return;
          }

          var rowNumber = String(index + 1);
          var toggleControl = row.querySelector('button[onclick*="showHide"], input[onclick*="showHide"], a[onclick*="showHide"], .ficsRoundPlus');
          var countText = cells[2] ? (cells[2].textContent || '').replace(/\\s+/g, ' ').trim() : '';
          var links = Array.from(cells[1].querySelectorAll('a.docLink'));
          var titleLink = links[0] || null;
          var rawTitleText = titleLink ? (titleLink.textContent || '').replace(/\\s+/g, ' ').trim() : (cells[1].textContent || '').replace(/\\s+/g, ' ').trim();
          var titleText = rawTitleText || row.dataset.brightshoreDocumentTitle || '';

          if (rawTitleText) {
            row.dataset.brightshoreDocumentTitle = rawTitleText;
          }

          var mobileCell = existingMobile || document.createElement('td');
          mobileCell.className = 'brightshore-document-mobile';
          mobileCell.setAttribute('colspan', String(Math.max(cells.length, 1)));

          if (!existingMobile) {
            row.appendChild(mobileCell);
          }

          if (!mobileCell.firstElementChild) {
            var card = document.createElement('div');
            var toggleSlot = document.createElement('div');
            var titleSlot = document.createElement('div');
            var countSlot = document.createElement('div');
            var bodySlot = document.createElement('div');

            card.className = 'brightshore-document-card';
            toggleSlot.className = 'brightshore-document-toggle';
            titleSlot.className = 'brightshore-document-title';
            countSlot.className = 'brightshore-document-count';
            bodySlot.className = 'brightshore-document-body';

            card.appendChild(toggleSlot);
            card.appendChild(titleSlot);
            card.appendChild(countSlot);
            card.appendChild(bodySlot);
            mobileCell.appendChild(card);
          }

          var toggleSlot = mobileCell.querySelector('.brightshore-document-toggle');
          var titleSlot = mobileCell.querySelector('.brightshore-document-title');
          var countSlot = mobileCell.querySelector('.brightshore-document-count');
          var bodySlot = mobileCell.querySelector('.brightshore-document-body');

          if (toggleSlot && toggleControl && !toggleSlot.contains(toggleControl)) {
            toggleSlot.textContent = '';
            toggleSlot.appendChild(toggleControl);
          }

          if (toggleControl && !toggleControl.dataset.brightshoreDocumentToggleReady) {
            toggleControl.dataset.brightshoreDocumentToggleReady = 'true';
            toggleControl.setAttribute('aria-expanded', row.classList.contains('brightshore-document-expanded') ? 'true' : 'false');
            toggleControl.onclick = function(event) {
              event.preventDefault();
              event.stopPropagation();
              var isExpanded = row.classList.toggle('brightshore-document-expanded');
              toggleControl.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
              var icon = toggleControl.querySelector('i');
              if (icon) {
                icon.classList.toggle('nc-simple-add', !isExpanded);
                icon.classList.toggle('nc-simple-delete', isExpanded);
              }
              return false;
            };
          }

          if (titleSlot && titleLink && !titleSlot.contains(titleLink)) {
            titleSlot.textContent = '';
            titleSlot.appendChild(titleLink);
          } else if (titleSlot && !titleLink && !titleSlot.textContent.trim()) {
            titleSlot.textContent = titleText;
          }

          if (countSlot) {
            countSlot.textContent = countText || rowNumber;
          }

          if (bodySlot) {
            Array.from(links).slice(titleSlot && titleSlot.contains(titleLink) ? 1 : 0).forEach(function(link) {
              if (!bodySlot.contains(link)) {
                bodySlot.appendChild(link);
              }
            });

            if (!bodySlot.textContent.trim() && titleText && countText && countText !== '1') {
              bodySlot.textContent = titleText;
            }
          }
        });
      }

      function normalizeLoginModals() {
        if (!document.body) {
          return;
        }

        const openModals = Array.from(document.querySelectorAll('.modal.show, .modal.in, .modal[style*="display: block"]'));
        document.body.classList.toggle('brightshore-modal-clean', openModals.length > 0);

        Array.from(document.querySelectorAll('.modal-body textarea')).forEach(function(textarea) {
          if (textarea.dataset.brightshoreModalTextReady === 'true') {
            return;
          }

          var text = textarea.value || textarea.textContent || '';
          textarea.dataset.brightshoreModalTextReady = 'true';

          if (!text.trim()) {
            textarea.style.display = 'none';
            return;
          }

          var replacement = document.createElement('div');
          replacement.className = 'brightshore-modal-text';
          replacement.innerHTML = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1">$1</a>')
            .replace(/\\n{2,}/g, '</p><p>')
            .replace(/\\n/g, '<br>');
          replacement.innerHTML = '<p>' + replacement.innerHTML + '</p>';
          textarea.parentNode.insertBefore(replacement, textarea);
          textarea.style.display = 'none';
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });

        openModals.forEach(function(modal) {
          Array.from(modal.querySelectorAll('.modal-body [style]')).forEach(function(element) {
            var text = (element.textContent || '').replace(/\\s+/g, ' ').trim();
            if (!text || element.querySelector('input, select, button')) {
              return;
            }

            element.style.background = 'transparent';
            element.style.border = '0';
            element.style.boxShadow = 'none';
          });
        });
      }

      function normalizePortalDropdowns() {
        if (!document.body) {
          return;
        }

        function shouldUseFixedDropdown(toggle) {
          var isWideViewport = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0) >= 768;
          var isCollapsedMenu = !!toggle.closest('.sidebar, .offcanvas, .drawer, .sidenav, .side-nav, .mobile-menu, .navbar-collapse.show, .collapse.show');

          return isWideViewport && !isCollapsedMenu;
        }

        function positionFixedDropdown(toggle, menu) {
          var rect = toggle.getBoundingClientRect();
          var visualViewport = window.visualViewport || null;
          var viewportLeft = visualViewport ? visualViewport.offsetLeft || 0 : 0;
          var viewportTop = visualViewport ? visualViewport.offsetTop || 0 : 0;
          var viewportWidth = visualViewport
            ? visualViewport.width || window.innerWidth || document.documentElement.clientWidth || 0
            : Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
          var menuWidth = Math.min(Math.max(menu.offsetWidth || 320, 320), Math.max(viewportWidth - 24, 320));
          var toggleCenter = rect.left + rect.width / 2 + viewportLeft;
          var left = toggleCenter - menuWidth / 2;
          var minLeft = viewportLeft + 12;
          var maxLeft = viewportLeft + viewportWidth - menuWidth - 12;

          if (left > maxLeft) {
            left = maxLeft;
          }

          if (left < minLeft) {
            left = minLeft;
          }

          var arrowLeft = Math.max(24, Math.min(menuWidth - 24, toggleCenter - left));

          menu.style.position = 'fixed';
          menu.style.top = Math.round(rect.bottom + viewportTop + 8) + 'px';
          menu.style.left = Math.round(left) + 'px';
          menu.style.right = 'auto';
          menu.style.width = menuWidth + 'px';
          menu.style.minWidth = menuWidth + 'px';
          menu.style.transform = 'none';
          menu.style.setProperty('--brightshore-dropdown-arrow-left', Math.round(arrowLeft) + 'px');
        }

        function makeDropdownAncestorsVisible(dropdown) {
          var element = dropdown.parentElement;

          while (element && element !== document.body) {
            var overflow = window.getComputedStyle(element).overflow;

            if (overflow && overflow !== 'visible') {
              if (!element.classList.contains('brightshore-dropdown-overflow-visible')) {
                element.dataset.brightshorePreviousOverflow = element.style.overflow || '';
              }
              element.classList.add('brightshore-dropdown-overflow-visible');
              element.style.overflow = 'visible';
            }

            element = element.parentElement;
          }
        }

        function resetDropdownMenu(menu) {
          menu.classList.remove('brightshore-dropdown-open', 'brightshore-dropdown-fixed', 'brightshore-dropdown-inline');
          menu.style.position = '';
          menu.style.top = '';
          menu.style.left = '';
          menu.style.right = '';
          menu.style.width = '';
          menu.style.minWidth = '';
          menu.style.transform = '';
        }

        Array.from(document.querySelectorAll('.dropdown, .nav-item.dropdown')).forEach(function(dropdown) {
          var toggle = dropdown.querySelector('.dropdown-toggle, [data-toggle="dropdown"], [data-bs-toggle="dropdown"], a, button');
          var menu = dropdown.querySelector('.dropdown-menu');

          if (!menu) {
            return;
          }

          var isOpen = dropdown.classList.contains('show') ||
            dropdown.classList.contains('open') ||
            menu.classList.contains('show') ||
            menu.classList.contains('open') ||
            menu.style.display === 'block';

          if (!isOpen) {
            resetDropdownMenu(menu);
            return;
          }

          makeDropdownAncestorsVisible(dropdown);
          menu.classList.add('brightshore-dropdown-open');

          if (toggle && shouldUseFixedDropdown(toggle)) {
            menu.classList.add('brightshore-dropdown-fixed');
            menu.classList.remove('brightshore-dropdown-inline');
            positionFixedDropdown(toggle, menu);
          } else {
            menu.classList.add('brightshore-dropdown-inline');
            menu.classList.remove('brightshore-dropdown-fixed');
            menu.style.position = 'static';
            menu.style.top = '';
            menu.style.left = '';
            menu.style.right = '';
            menu.style.width = '';
            menu.style.minWidth = '';
            menu.style.transform = 'none';
          }
        });

        if (document.body.dataset.brightshoreDropdownCleanupReady === 'true') {
          return;
        }

        document.body.dataset.brightshoreDropdownCleanupReady = 'true';
        document.addEventListener('click', function(event) {
          window.setTimeout(function() {
            if (event.target && event.target.closest && event.target.closest('.dropdown, .nav-item.dropdown, .dropdown-menu')) {
              return;
            }

            Array.from(document.querySelectorAll('.dropdown-menu.brightshore-dropdown-open')).forEach(resetDropdownMenu);
          }, 0);
        }, true);
      }

      function runServicingPolish() {
        if (!document.body) {
          return;
        }

        applyServicingPageClass();
        normalizePortalDropdowns();
        normalizeCurrencyInputs();
        normalizeAccountNotes();
        normalizePaymentHistory();
        normalizeDashboardPayments();
        normalizeDocuments();
        normalizeLoginModals();
      }

      runServicingPolish();
      document.addEventListener('DOMContentLoaded', runServicingPolish);
      window.addEventListener('popstate', applyServicingPageClass);
      var originalPushState = window.history.pushState;
      var originalReplaceState = window.history.replaceState;
      window.history.pushState = function() {
        var result = originalPushState.apply(this, arguments);
        setTimeout(applyServicingPageClass, 0);
        return result;
      };
      window.history.replaceState = function() {
        var result = originalReplaceState.apply(this, arguments);
        setTimeout(applyServicingPageClass, 0);
        return result;
      };
      setInterval(runServicingPolish, 1000);

    }

    function revealPolishedPage() {
      if (!shouldPreparePolish) {
        return;
      }

      window.requestAnimationFrame(function() {
        window.setTimeout(function() {
          if (!document.body) {
            return;
          }

          document.documentElement.classList.remove('brightshore-webview-preparing');
          document.documentElement.classList.add('brightshore-webview-ready');
        }, 40);
      });
    }

    revealPolishedPage();

    function applyCookieConsent() {
      if (!window.Cookiebot || typeof window.Cookiebot.submitCustomConsent !== 'function') {
        return false;
      }

      if (isTrackingAuthorized) {
        window.Cookiebot.submitCustomConsent(true, true, true);
      } else {
        window.Cookiebot.submitCustomConsent(false, false, false);
      }

      if (typeof window.Cookiebot.hide === 'function') {
        window.Cookiebot.hide();
      }

      return true;
    }

    if (!applyCookieConsent()) {
      var attempts = 0;
      var consentInterval = window.setInterval(function() {
        attempts += 1;
        if (applyCookieConsent() || attempts >= 40) {
          window.clearInterval(consentInterval);
        }
      }, 250);
    }

    var documentExtensions = ${JSON.stringify(DOCUMENT_EXTENSIONS)};
    var documentUrlHints = ${JSON.stringify(DOCUMENT_URL_HINTS)};
    var lastPrintGestureAt = 0;

    if (isConfiguredEStatusHost) {
      return true;
    }

    function isDocumentLink(href) {
      try {
        var url = new URL(href, window.location.href);
        var pathname = url.pathname.toLowerCase();
        var search = url.search.toLowerCase();
        var isDocumentsIndex = pathname === '/documents' || pathname.endsWith('/documents');
        if (isDocumentsIndex) {
          return false;
        }

        var hasDocumentExtension = documentExtensions.some(function(extension) {
          return pathname.endsWith('.' + extension);
        });
        var hasDocumentHint = documentUrlHints.some(function(hint) {
          return pathname.indexOf(hint) >= 0 || search.indexOf(hint) >= 0;
        });

        return hasDocumentExtension || hasDocumentHint;
      } catch (error) {
        return false;
      }
    }

    if (window.__brightshoreDocumentHandlerInstalled) {
      return true;
    }
    window.__brightshoreDocumentHandlerInstalled = true;

    let lastPrintMessageAt = 0;

    function markPrintGesture() {
      lastPrintGestureAt = Date.now();
    }

    function hasRecentPrintGesture() {
      return Date.now() - lastPrintGestureAt < 5000;
    }

    function postPrintMessage(html, baseUri, title) {
      if (!hasRecentPrintGesture()) {
        return;
      }

      lastPrintMessageAt = Date.now();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'print-html',
        html: html || '',
        baseUri: baseUri || window.location.href,
        title: title || document.title || ''
      }));
    }

    function postPrintUrlMessage(uri) {
      if (!hasRecentPrintGesture()) {
        return;
      }

      lastPrintMessageAt = Date.now();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'print-url',
        uri: uri,
        cookie: document.cookie || '',
        title: document.title || ''
      }));
    }

    function getElementText(element) {
      if (!element) {
        return '';
      }

      return [
        element.textContent || '',
        element.value || '',
        element.title || '',
        element.getAttribute && element.getAttribute('aria-label') || '',
        element.id || '',
        typeof element.className === 'string' ? element.className : '',
        element.getAttribute && element.getAttribute('onclick') || ''
      ].join(' ').replace(/\\s+/g, ' ').trim();
    }

    function isPrintControl(element) {
      const text = getElementText(element).toLowerCase();
      return /\\bprint\\b|printmemo|printreceipt|printdetail/.test(text);
    }

    function isEStatusLoginForm(form) {
      if (!isConfiguredEStatusHost || !form || !form.querySelector) {
        return false;
      }

      var hasPasswordField = !!form.querySelector('input[type="password"]');
      if (!hasPasswordField) {
        return false;
      }

      var action = String(form.action || form.getAttribute('action') || '').toLowerCase();
      var formText = getElementText(form).toLowerCase();
      return (
        action.indexOf('login') >= 0 ||
        /\\blog\\s*in\\b|\\bsign\\s*in\\b/.test(formText)
      );
    }

    function escapePrintHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function getCleanText(value) {
      return String(value || '').replace(/\\s+/g, ' ').trim();
    }

    function getMultilineHtml(value) {
      return escapePrintHtml(String(value || '').trim()).replace(/\\n/g, '<br>');
    }

    function getStructuredNotePrintHtml(control) {
      const row = control && control.closest ? control.closest('#ResultsGrid > tbody > tr, tr[id^="row_"]') : null;

      if (!row || !document.body || !document.body.classList.contains('brightshore-page-memo')) {
        return '';
      }

      const cells = Array.from(row.children).filter(function(cell) {
        return cell && cell.tagName && cell.tagName.toLowerCase() === 'td' && !(cell.classList && cell.classList.contains('brightshore-note-mobile'));
      });
      const subjectFromData = getCleanText(row.getAttribute('data-subject'));
      const bodyFromData = String(row.getAttribute('data-body') || '').trim();
      const createdFromData = getCleanText(row.getAttribute('data-createdate'));
      const subjectCell = cells.find(function(cell) {
        const text = getCleanText(cell.textContent);
        return text && !/\\bprint\\b/i.test(text) && !/\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/.test(text);
      });
      const dateCell = cells.find(function(cell) {
        return /\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/.test(getCleanText(cell.textContent));
      });
      const bodySlot = row.querySelector('.brightshore-note-card-body');
      const expandedText = getCleanText(bodySlot ? bodySlot.textContent : '');
      const subject = subjectFromData || getCleanText(subjectCell ? subjectCell.textContent : '') || 'Account Note';
      const created = createdFromData || getCleanText(dateCell ? dateCell.textContent : '');
      const body = bodyFromData || expandedText || getCleanText(row.textContent).replace(/\\bPrint\\b/gi, '').trim();

      if (!body && !subject) {
        return '';
      }

      return [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<style>',
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#252b33;margin:32px;line-height:1.45;}',
        '.note{border:1px solid #dfe3e8;border-radius:8px;overflow:hidden;}',
        '.head{background:#f8fafc;border-bottom:1px solid #dfe3e8;padding:18px 22px;}',
        'h1{font-size:22px;line-height:1.25;margin:0 0 8px;color:#20242a;}',
        '.meta{font-size:13px;color:#66707c;font-weight:600;}',
        '.body{padding:22px;font-size:15px;white-space:normal;}',
        '.label{font-size:12px;color:#66707c;font-weight:800;text-transform:uppercase;margin-bottom:8px;}',
        '</style>',
        '</head>',
        '<body>',
        '<article class="note">',
        '<div class="head">',
        '<h1>' + escapePrintHtml(subject) + '</h1>',
        created ? '<div class="meta">Created: ' + escapePrintHtml(created) + '</div>' : '',
        '</div>',
        '<div class="body">',
        '<div class="label">Note</div>',
        '<div>' + getMultilineHtml(body) + '</div>',
        '</div>',
        '</article>',
        '</body>',
        '</html>'
      ].join('');
    }

    function getStructuredPaymentPrintHtml(control) {
      const row = control && control.closest ? control.closest('#ResultsGrid > tbody > tr, tr[id^="row_"]') : null;

      if (!row || !document.body || !document.body.classList.contains('brightshore-page-payment-history')) {
        return '';
      }

      const cells = Array.from(row.children).filter(function(cell) {
        return cell && cell.tagName && cell.tagName.toLowerCase() === 'td' && !(cell.classList && cell.classList.contains('brightshore-payment-mobile'));
      });
      const values = cells.map(function(cell) {
        return getCleanText(cell.textContent).replace(/\\bView\\b/gi, '').replace(/\\bPrint\\b/gi, '').trim();
      }).filter(Boolean);
      const labels = ['Due Date', 'Paid Date', 'Amount', 'Description', 'Status'];
      const rows = values.slice(0, 6).map(function(value, index) {
        return '<tr><th>' + escapePrintHtml(labels[index] || ('Detail ' + (index + 1))) + '</th><td>' + escapePrintHtml(value) + '</td></tr>';
      }).join('');

      if (!rows) {
        return '';
      }

      return [
        '<!doctype html><html><head><meta charset="utf-8">',
        '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#252b33;margin:32px;}h1{font-size:22px;margin:0 0 18px;}table{width:100%;border-collapse:collapse;border:1px solid #dfe3e8;}th,td{padding:12px;border-bottom:1px solid #edf0f3;text-align:left;vertical-align:top;}th{width:34%;background:#f8fafc;color:#66707c;font-size:12px;text-transform:uppercase;}</style>',
        '</head><body><h1>Payment Detail</h1><table>',
        rows,
        '</table></body></html>'
      ].join('');
    }

    function getStructuredPrintHtml(control) {
      return getStructuredNotePrintHtml(control) || getStructuredPaymentPrintHtml(control);
    }

    function getUrlFromPrintControl(element) {
      if (!element) {
        return '';
      }

      const directUrl =
        element.href ||
        element.action ||
        element.formAction ||
        element.getAttribute && (
          element.getAttribute('data-url') ||
          element.getAttribute('data-href') ||
          element.getAttribute('data-action') ||
          element.getAttribute('formaction')
        );

      if (directUrl && !/^javascript:/i.test(String(directUrl))) {
        return new URL(String(directUrl), window.location.href).href;
      }

      const onclick = element.getAttribute && element.getAttribute('onclick');
      const match = onclick && onclick.match(/(?:window\\.)?(?:open|location(?:\\.href)?|assign)\\s*\\(?\\s*['"]([^'"]+)['"]/i);

      if (match && match[1] && !/^javascript:/i.test(match[1])) {
        return new URL(match[1], window.location.href).href;
      }

      return '';
    }

    function schedulePrintFallback(title, control) {
      const printStartedAt = Date.now();
      const structuredHtml = getStructuredPrintHtml(control);

      if (structuredHtml) {
        postPrintMessage(structuredHtml, window.location.href, title || document.title || '');
        return;
      }

      window.setTimeout(function() {
        if (lastPrintMessageAt >= printStartedAt) {
          return;
        }

        postPrintMessage(document.documentElement.outerHTML, window.location.href, title || document.title || '');
      }, 350);
    }

    function createPrintablePopup(initialUrl) {
      let htmlParts = [];
      const popupDocument = {
        title: document.title || '',
        body: {
          innerHTML: '',
          appendChild: function(node) {
            if (node && node.outerHTML) {
              htmlParts.push(node.outerHTML);
            } else if (node && node.textContent) {
              htmlParts.push(node.textContent);
            }
            return node;
          }
        },
        open: function() {
          htmlParts = [];
          this.body.innerHTML = '';
          return this;
        },
        close: function() {
          return undefined;
        },
        write: function(value) {
          const nextValue = String(value || '');
          htmlParts.push(nextValue);
          this.body.innerHTML += nextValue;
        },
        writeln: function(value) {
          this.write(String(value || '') + '\\n');
        },
        createElement: function(tagName) {
          return document.createElement(tagName);
        },
        get documentElement() {
          return { outerHTML: htmlParts.join('') || this.body.innerHTML };
        }
      };
      const popup = {
        closed: false,
        document: popupDocument,
        location: { href: initialUrl || 'about:blank' },
        opener: window,
        self: null,
        window: null,
        focus: function() {},
        close: function() {
          this.closed = true;
        },
        print: function() {
          if (!hasRecentPrintGesture()) {
            return;
          }

          postPrintMessage(htmlParts.join('') || popupDocument.body.innerHTML || document.documentElement.outerHTML, initialUrl || window.location.href, popupDocument.title || document.title || '');
        },
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window)
      };
      popup.self = popup;
      popup.window = popup;
      return popup;
    }

    window.print = function() {
      if (!hasRecentPrintGesture()) {
        return;
      }

      postPrintMessage(document.documentElement.outerHTML, window.location.href, document.title || '');
    };

    const originalWindowOpen = window.open;
    window.open = function(url, target, features) {
      var resolvedUrl = url ? new URL(url, window.location.href).href : '';

      if (resolvedUrl && isDocumentLink(resolvedUrl)) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'document-link',
          uri: resolvedUrl,
          cookie: document.cookie || ''
        }));
        return null;
      }

      if (resolvedUrl && /print|receipt|statement|memo|detail/i.test(resolvedUrl + ' ' + (target || '') + ' ' + (features || ''))) {
        if (!hasRecentPrintGesture()) {
          return originalWindowOpen.call(window, url, target, features);
        }

        postPrintUrlMessage(resolvedUrl);
        return createPrintablePopup(resolvedUrl);
      }

      if (!resolvedUrl || resolvedUrl === 'about:blank') {
        if (!hasRecentPrintGesture()) {
          return originalWindowOpen.call(window, url, target, features);
        }

        return createPrintablePopup(window.location.href);
      }

      return originalWindowOpen.call(window, url, target, features);
    };

    document.addEventListener('click', function(event) {
      const printControl = event.target && event.target.closest
        ? event.target.closest('button, input[type="button"], input[type="submit"], a, [role="button"], [onclick], .btn')
        : null;

      if (printControl && isPrintControl(printControl)) {
        markPrintGesture();
        const structuredHtml = getStructuredPrintHtml(printControl);

        if (structuredHtml) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          postPrintMessage(structuredHtml, window.location.href, getElementText(printControl) || document.title || '');
          return;
        }

        const printUrl = getUrlFromPrintControl(printControl);

        if (printUrl) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          postPrintUrlMessage(printUrl);
          return;
        }

        schedulePrintFallback(getElementText(printControl) || document.title || '', printControl);
      }

      const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link) {
        return;
      }

      if (link.classList && link.classList.contains('docLink') && link.dataset && link.dataset.dockey) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'document-key',
          docKey: link.dataset.dockey,
          label: link.textContent ? link.textContent.trim() : '',
          cookie: document.cookie || ''
        }));
        return;
      }

      if (!isDocumentLink(link.href)) {
        return;
      }

      event.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'document-link',
        uri: link.href,
        cookie: document.cookie || ''
      }));
    }, true);

    document.addEventListener('submit', function(event) {
      const form = event.target;
      if (!form || !form.matches || !form.matches('form')) {
        return;
      }

      if (isEStatusLoginForm(form)) {
        return;
      }

      const action = form.action || form.getAttribute('action') || '';
      const actionLooksPrint = /(?:^|[\\/?&#=_-])print(?:$|[\\/?&#=_-])|printmemo|printreceipt|printdetail/i.test(String(action));
      const submitter = event.submitter ||
        (document.activeElement && form.contains(document.activeElement) ? document.activeElement : null);
      const submitterLooksPrint = !!(submitter && isPrintControl(submitter));

      if (!submitterLooksPrint && !actionLooksPrint) {
        return;
      }

      markPrintGesture();
      const structuredHtml = getStructuredPrintHtml(submitter || form);

      if (structuredHtml) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        postPrintMessage(structuredHtml, window.location.href, document.title || '');
        return;
      }

      if (action) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        postPrintUrlMessage(new URL(action, window.location.href).href);
        return;
      }

      schedulePrintFallback(document.title || '', form);
    }, true);
    
    function scrollToHash() {
      var hash = window.location.hash;
      if (hash) {
        setTimeout(function() {
          var el = document.querySelector(hash);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
    window.addEventListener('hashchange', scrollToHash);
    scrollToHash();
    true;
  })();
`;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View>
        <ContactAccordion onNavigate={handleNavigate} />
      </View>
      {!isTrackingPermissionReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={brand.primary} size="large" />
        </View>
      ) : isOffline ? (
        <View style={styles.offlineContainer}>
          <View style={styles.offlineCard}>
            <Text style={styles.offlineText}>No Internet Connection</Text>
            <TouchableOpacity
              style={styles.reloadButton}
              onPress={() => setWebviewKey((prev) => prev + 1)}
            >
              <Text style={styles.reloadText}>Reload</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <WebView
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);

              if (message?.type === "document-link" && message.uri) {
                openAuthenticatedDocument(message.uri, true, message.cookie);
              }

              if (message?.type === "document-key" && message.docKey) {
                logDocumentEvent("document key", {
                  label: message.label,
                  docKeyLength: message.docKey.length,
                });
                openDocumentByKey(message.docKey, message.cookie);
              }

              if (message?.type === "print-html" && message.html) {
                printHtml(message.html, message.baseUri, message.title);
              }

              if (message?.type === "print-url" && message.uri) {
                printAuthenticatedUrl(message.uri, message.cookie);
              }

            } catch {}
          }}
          ref={webViewRef}
          key={webviewKey}
          source={{ uri: currentUri }}
          style={styles.webview}
          onNavigationStateChange={(navState) => {
            setCurrentUri((previousUri) =>
              previousUri === navState.url ? previousUri : navState.url
            );
            openPendingEmbeddedLogin(navState.url);
          }}
          onLoadEnd={(event) => {
            openPendingEmbeddedLogin(event.nativeEvent.url);
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (!request.url) {
              return true;
            }

            if (isDocumentUrl(request.url)) {
              openAuthenticatedDocument(request.url);
              return false;
            }

            return true;
          }}
          onFileDownload={({ nativeEvent }) => {
            openAuthenticatedDocument(nativeEvent.downloadUrl);
          }}
          injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
          injectedJavaScript={injectedJavaScript}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          bounces={false}
          overScrollMode="never"
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
        />
      )}
      {isOpeningDocument ? (
        <View style={styles.documentLoadingOverlay}>
          <View style={styles.documentLoadingCard}>
            <ActivityIndicator color={brand.primary} size="small" />
            <Text style={styles.documentLoadingText}>Opening document...</Text>
          </View>
        </View>
      ) : null}
      <BottomBar onNavigate={handleNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.OS === "ios" ? brand.primary : "",
  },
  webview: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  offlineContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 20,
  },
  offlineCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
    maxWidth: "90%",
  },
  offlineText: {
    fontSize: moderateScale(18),
    fontWeight: "600",
    color: brand.textColorSecondary,
    marginBottom: 16,
    textAlign: "center",
  },
  reloadButton: {
    backgroundColor: brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: brand.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 3,
  },
  reloadText: {
    color: brand.iconColor,
    fontSize: moderateScale(16),
    fontWeight: "600",
    textAlign: "center",
  },
  documentLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    zIndex: 100,
  },
  documentLoadingCard: {
    minWidth: 180,
    borderRadius: 8,
    padding: 18,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  documentLoadingText: {
    marginTop: 10,
    color: brand.textColorSecondary,
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
});
