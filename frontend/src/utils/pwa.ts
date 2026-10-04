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
