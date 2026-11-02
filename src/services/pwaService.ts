import { getActiveLanguage } from '../languages';

export const PWA_DISMISS_COOLDOWN_DAYS = 14;
export const PWA_DISMISS_COOLDOWN_MS = PWA_DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type MobilePlatform = 'ios' | 'android' | 'other';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let sessionAccepted = false;
let manualInstallModalOpen = false;
let initialized = false;
const memoryDismissedUntil = new Map<string, number>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (_) {}
  });
}

export function subscribePWAState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isLibraryPath(
  win: any = typeof window !== 'undefined' ? window : undefined
): boolean {
  try {
    return Boolean(
      win &&
        win.location &&
        typeof win.location.pathname === 'string' &&
        win.location.pathname.includes('/library')
    );
  } catch (_) {
    return false;
  }
}

export function getDismissStorageKey(
  storagePrefix = getActiveLanguage().storagePrefix,
  isLibrary = isLibraryPath()
): string {
  return isLibrary
    ? `${storagePrefix}_library_pwa_install_dismissed_until_v1`
    : `${storagePrefix}_pwa_install_dismissed_until_v1`;
}

export function detectMobilePlatform(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0
): MobilePlatform {
  const cleanUa = String(ua || '');
  if (/iPhone|iPad|iPod/i.test(cleanUa)) {
    return 'ios';
  }
  if (/Macintosh/i.test(cleanUa) && maxTouchPoints > 1) {
    return 'ios';
  }
  if (/Android/i.test(cleanUa)) {
    return 'android';
  }
  return 'other';
}

export function isSafariOnIOS(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): boolean {
  const cleanUa = String(ua || '');
  return (
    /Safari/i.test(cleanUa) &&
    !/CriOS|FxiOS|OPiOS|EdgiOS|Instagram|FBAN|FBAV|WhatsApp/i.test(cleanUa)
  );
}

/**
 * Checks whether the web app is currently running in standalone installed mode.
 * Does NOT rely on any permanently saved installation flag in localStorage.
 */
export function isRunningStandalone(
  win: any = typeof window !== 'undefined' ? window : undefined,
  nav: any = typeof navigator !== 'undefined' ? navigator : undefined,
  doc: any = typeof document !== 'undefined' ? document : undefined
): boolean {
  if (sessionAccepted) return true;
  if (!win) return false;

  try {
    if (win.Capacitor && typeof win.Capacitor.isNativePlatform === 'function' && win.Capacitor.isNativePlatform()) {
      return true;
    }
  } catch (_) {}

  try {
    if (typeof win.matchMedia === 'function') {
      if (
        win.matchMedia('(display-mode: standalone)').matches ||
        win.matchMedia('(display-mode: fullscreen)').matches ||
        win.matchMedia('(display-mode: minimal-ui)').matches
      ) {
        return true;
      }
    }
  } catch (_) {}

  try {
    if (nav && nav.standalone === true) {
      return true;
    }
  } catch (_) {}

  try {
    if (doc && typeof doc.referrer === 'string' && doc.referrer.includes('android-app://')) {
      return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Checks whether the user dismissed the installation invitation within the last 14 days.
 */
export function isInstallPromptDismissed(
  storagePrefix = getActiveLanguage().storagePrefix,
  now = Date.now(),
  isLibrary = isLibraryPath()
): boolean {
  const key = getDismissStorageKey(storagePrefix, isLibrary);
  const memVal = memoryDismissedUntil.get(key);
  if (typeof memVal === 'number' && now < memVal) {
    return true;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && now < until) {
          return true;
        }
      }
    }
  } catch (_) {}

  return false;
}

/**
 * Dismisses the installation invitation for 14 days for the specified language.
 */
export function dismissInstallPrompt(
  storagePrefix = getActiveLanguage().storagePrefix,
  now = Date.now(),
  isLibrary = isLibraryPath()
): number {
  const until = now + PWA_DISMISS_COOLDOWN_MS;
  const key = getDismissStorageKey(storagePrefix, isLibrary);
  memoryDismissedUntil.set(key, until);
  manualInstallModalOpen = false;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(until));
    }
  } catch (_) {}

  notifyListeners();
  return until;
}

export function clearInstallPromptDismissal(
  storagePrefix = getActiveLanguage().storagePrefix,
  isLibrary?: boolean
): void {
  const keys =
    typeof isLibrary === 'boolean'
      ? [getDismissStorageKey(storagePrefix, isLibrary)]
      : [
          getDismissStorageKey(storagePrefix, false),
          getDismissStorageKey(storagePrefix, true)
        ];
  manualInstallModalOpen = false;
  for (const key of keys) {
    memoryDismissedUntil.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (_) {}
  }
  notifyListeners();
}

export function hasDeferredInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export function setDeferredInstallPromptForTest(promptEvent: BeforeInstallPromptEvent | null): void {
  deferredPrompt = promptEvent;
  sessionAccepted = false;
  manualInstallModalOpen = false;
  notifyListeners();
}

export function isManualInstallModalOpen(): boolean {
  return manualInstallModalOpen;
}

export function openManualInstallModal(): void {
  manualInstallModalOpen = true;
  notifyListeners();
}

export function closeManualInstallModal(): void {
  if (manualInstallModalOpen) {
    manualInstallModalOpen = false;
    notifyListeners();
  }
}

export async function triggerNativeInstallPrompt(
  storagePrefix = getActiveLanguage().storagePrefix
): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }
  const currentPrompt = deferredPrompt;
  deferredPrompt = null;
  try {
    await currentPrompt.prompt();
    const choice = await currentPrompt.userChoice;
    if (choice && choice.outcome === 'accepted') {
      sessionAccepted = true;
      manualInstallModalOpen = false;
      notifyListeners();
      return 'accepted';
    }
    dismissInstallPrompt(storagePrefix);
    return 'dismissed';
  } catch (_) {
    notifyListeners();
    return 'unavailable';
  }
}

/**
 * Triggered when a user explicitly taps the visible "Install Library" (or "Install App") button.
 * Works even when the automatic 14-day invitation was previously dismissed.
 * - On Android when native `beforeinstallprompt` is ready, immediately invokes the native prompt.
 * - Otherwise opens the install instructions popup/modal.
 */
export async function requestInstallApp(
  storagePrefix = getActiveLanguage().storagePrefix
): Promise<'accepted' | 'dismissed' | 'manual_shown'> {
  if (deferredPrompt) {
    const outcome = await triggerNativeInstallPrompt(storagePrefix);
    if (outcome === 'accepted' || outcome === 'dismissed') {
      manualInstallModalOpen = false;
      notifyListeners();
      return outcome;
    }
  }
  manualInstallModalOpen = true;
  notifyListeners();
  return 'manual_shown';
}

export function shouldShowInstallInvitation(options?: {
  storagePrefix?: string;
  ua?: string;
  maxTouchPoints?: number;
  viewportWidth?: number;
  now?: number;
  win?: any;
  nav?: any;
  doc?: any;
  isLibrary?: boolean;
}): boolean {
  const lang = getActiveLanguage();
  const storagePrefix = options?.storagePrefix || lang.storagePrefix;
  const now = options?.now ?? Date.now();
  const isLib = options?.isLibrary ?? isLibraryPath(options?.win);

  if (isRunningStandalone(options?.win, options?.nav, options?.doc)) {
    return false;
  }

  if (manualInstallModalOpen) {
    return true;
  }

  if (isInstallPromptDismissed(storagePrefix, now, isLib)) {
    return false;
  }

  const platform = detectMobilePlatform(options?.ua, options?.maxTouchPoints);
  if (platform === 'ios' || platform === 'android') {
    return true;
  }

  if (deferredPrompt !== null) {
    return true;
  }

  const width =
    options?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  return width <= 640;
}

/**
 * Synchronizes document head metadata & manifest link with the active language
 * and registers the lightweight pass-through service worker.
 */
export function initPWAService(): void {
  if (typeof window === 'undefined') return;

  try {
    const lang = getActiveLanguage();
    const isLib = isLibraryPath(window);
    const appTitle = isLib
      ? `${lang.name} Community Library`
      : `${lang.name} Community Teachers`;
    const baseUrl = (import.meta as any)?.env?.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    if (typeof document !== 'undefined') {
      document.title = isLib
        ? `${lang.name} — Community Library`
        : `${lang.name} — Community Teachers`;

      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      const targetManifest = isLib
        ? `${cleanBase}manifest-${lang.id}-library.webmanifest`
        : `${cleanBase}manifest-${lang.id}.webmanifest`;
      if (manifestLink && manifestLink.getAttribute('href') !== targetManifest) {
        manifestLink.setAttribute('href', targetManifest);
      }

      const appleTitle = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-title"]'
      );
      if (appleTitle) {
        appleTitle.setAttribute('content', appTitle);
      }

      const icon192 = `${cleanBase}assets/${lang.id}-icon-192.png`;
      const icon512 = `${cleanBase}assets/${lang.id}-icon-512.png`;
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon) favicon.setAttribute('href', icon192);
      const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (appleIcon) appleIcon.setAttribute('href', icon512);
    }

    if (!initialized) {
      initialized = true;

      window.addEventListener('beforeinstallprompt', (e: Event) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        notifyListeners();
      });

      window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        sessionAccepted = true;
        manualInstallModalOpen = false;
        notifyListeners();
      });

      try {
        if (typeof window.matchMedia === 'function') {
          const mq = window.matchMedia('(display-mode: standalone)');
          if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', () => notifyListeners());
          }
        }
      } catch (_) {}

      if (
        'serviceWorker' in navigator &&
        (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
      ) {
        const registerSw = () => {
          navigator.serviceWorker
            .register(`${cleanBase}sw.js`, { scope: cleanBase })
            .catch(() => {});
        };
        if (typeof document !== 'undefined' && document.readyState === 'complete') {
          registerSw();
        } else {
          window.addEventListener('load', registerSw, { once: true });
        }
      }
    }
  } catch (_) {}
}
