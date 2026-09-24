import { useAuth } from 'react-oidc-context';
import { useAppSelector } from '../store/hooks';
import { selectAvatarOverride } from '../store/store';

/** Photo of the signed-in user: the last change made in the app, else the token's `picture` claim. */
export function useAvatarUrl(): string | null {
  const auth = useAuth();
  const override = useAppSelector(selectAvatarOverride);
  if (override !== undefined) return override;
  const picture = auth.user?.profile.picture;
  return typeof picture === 'string' && picture ? picture : null;
}
