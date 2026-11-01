import type { PlatformKind } from './platformApi';

/** "Toutes actives", "2 sur 7 suspendues", "Toutes suspendues". */
export function pauseSummary(kinds: PlatformKind[]): string {
  const paused = kinds.filter((kind) => kind.paused).length;
  if (paused === 0) return 'Toutes actives';
  return paused === kinds.length ? 'Toutes suspendues' : `${paused} sur ${kinds.length} suspendues`;
}
