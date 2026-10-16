// Extension de Navigator pour Safari iOS
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

/** True when the app runs installed (home screen), not in a browser tab. */
export function isInstalledPwa(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as NavigatorStandalone).standalone === true ||
         document.referrer.includes('android-app://');
}

/** iPhone or iPad (iPadOS announces itself as a Mac with a touch screen). */
export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Look of the platform's own controls (`data-platform` on <html>, read by
 * App.css): the iOS switches on an iPhone or iPad, Material ones elsewhere.
 */
export function applyPlatformLook(): void {
  document.documentElement.dataset.platform = isIosDevice() ? 'ios' : 'material';
}
