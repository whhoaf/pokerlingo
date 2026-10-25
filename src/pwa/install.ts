// Detecting iOS Safari in a browser tab, where the install screen is shown first.
// The functions take plain values so they can be tested without a browser.

export interface BrowserInfo {
  userAgent: string;
  maxTouchPoints: number;
}

export interface DisplayInfo {
  /** Safari's non-standard navigator.standalone. */
  navigatorStandalone: boolean | undefined;
  /** matchMedia('(display-mode: standalone)').matches */
  displayModeStandalone: boolean;
}

/** Safari on iPhone, iPod or iPad. Other iOS browsers and web views do not count. */
export function isIosSafari({ userAgent, maxTouchPoints }: BrowserInfo): boolean {
  const iPhoneOrPod = /iPhone|iPod/.test(userAgent);
  const iPadOs = /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!iPhoneOrPod && !iPadOs) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)) return false;
  return /Safari\//.test(userAgent);
}

export function isStandalone({ navigatorStandalone, displayModeStandalone }: DisplayInfo): boolean {
  return navigatorStandalone === true || displayModeStandalone;
}

/** The install screen shows on iOS Safari when not installed, unless the user chose to continue. */
export function shouldShowInstallScreen(browser: BrowserInfo, display: DisplayInfo, dismissed: boolean): boolean {
  return !dismissed && isIosSafari(browser) && !isStandalone(display);
}

/** Read the real values from the browser. */
export function readBrowser(): { browser: BrowserInfo; display: DisplayInfo } {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    browser: { userAgent: nav.userAgent, maxTouchPoints: nav.maxTouchPoints ?? 0 },
    display: {
      navigatorStandalone: nav.standalone,
      displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    },
  };
}
