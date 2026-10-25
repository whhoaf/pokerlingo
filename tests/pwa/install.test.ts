import { describe, expect, it } from 'vitest';
import { isIosSafari, isStandalone, shouldShowInstallScreen } from '../../src/pwa/install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const MAC_SAFARI = IPAD_SAFARI_DESKTOP_UA;
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_APP_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const DESKTOP_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('isIosSafari', () => {
  it('is true for iPhone Safari', () => {
    expect(isIosSafari({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe(true);
  });

  it('is true for iPadOS Safari, which sends a Mac user agent but has a touch screen', () => {
    expect(isIosSafari({ userAgent: IPAD_SAFARI_DESKTOP_UA, maxTouchPoints: 5 })).toBe(true);
  });

  it('is false for Safari on a Mac', () => {
    expect(isIosSafari({ userAgent: MAC_SAFARI, maxTouchPoints: 0 })).toBe(false);
  });

  it('is false for other browsers on iOS', () => {
    expect(isIosSafari({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: IPHONE_FIREFOX, maxTouchPoints: 5 })).toBe(false);
  });

  it('is false for a web view with no Safari token', () => {
    expect(isIosSafari({ userAgent: IPHONE_APP_WEBVIEW, maxTouchPoints: 5 })).toBe(false);
  });

  it('is false on Android and desktop', () => {
    expect(isIosSafari({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 })).toBe(false);
  });
});

describe('isStandalone', () => {
  it('is true when navigator.standalone is true', () => {
    expect(isStandalone({ navigatorStandalone: true, displayModeStandalone: false })).toBe(true);
  });

  it('is true in standalone display mode', () => {
    expect(isStandalone({ navigatorStandalone: undefined, displayModeStandalone: true })).toBe(true);
  });

  it('is false in a browser tab', () => {
    expect(isStandalone({ navigatorStandalone: false, displayModeStandalone: false })).toBe(false);
    expect(isStandalone({ navigatorStandalone: undefined, displayModeStandalone: false })).toBe(false);
  });
});

describe('shouldShowInstallScreen', () => {
  const iphone = { userAgent: IPHONE_SAFARI, maxTouchPoints: 5 };
  const tab = { navigatorStandalone: false, displayModeStandalone: false };
  const app = { navigatorStandalone: true, displayModeStandalone: true };

  it('shows on iOS Safari in a tab', () => {
    expect(shouldShowInstallScreen(iphone, tab, false)).toBe(true);
  });

  it('does not show once installed', () => {
    expect(shouldShowInstallScreen(iphone, app, false)).toBe(false);
  });

  it('does not show after "Continue in the browser"', () => {
    expect(shouldShowInstallScreen(iphone, tab, true)).toBe(false);
  });

  it('does not show on other browsers', () => {
    expect(shouldShowInstallScreen({ userAgent: DESKTOP_CHROME, maxTouchPoints: 0 }, tab, false)).toBe(false);
  });
});
