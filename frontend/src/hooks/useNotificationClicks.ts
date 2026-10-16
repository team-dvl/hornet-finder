import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * A tap on a notification while the app is open: the service worker brings
 * the app to the front and asks it to show the notification's page (a trap
 * reminder leads to `/traps/due?trap=<id>`). Only paths of the app are followed.
 */
export function useNotificationClicks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: unknown } | null;
      if (data?.type === 'navigate' && typeof data.url === 'string' && data.url.startsWith('/')
        && !data.url.startsWith('//')) {
        navigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
}
