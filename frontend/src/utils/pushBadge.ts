/**
 * App icon badge (Badging API) for notifications received while the app was
 * not in front. There is no inbox: the badge counts the pushes since the app
 * was last opened. The service worker (`sw.ts`) adds one per push and keeps the
 * count in this cache, which survives the worker being stopped; the page
 * (`clearPushBadge` in `push.ts`) empties it on launch and when it returns to
 * the foreground.
 *
 * Where it shows: a number on the icon on iPhone and iPad (installed app, with
 * the notification permission) and on desktops; Android only draws its own dot
 * while a notification is in the tray, whatever the count.
 */
export const BADGE_CACHE = 'push-badge';
export const BADGE_KEY = '/__push-badge';
