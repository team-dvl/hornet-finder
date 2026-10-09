import type { ComponentType } from 'react';
import type { DocModuleId } from './anchors';
import AdminDoc from './AdminDoc';
import ApiariesDoc from './ApiariesDoc';
import NestsDoc from './NestsDoc';
import StatsDoc from './StatsDoc';
import TrapsDoc from './TrapsDoc';

/**
 * Documentation of each module, shown in the help panel. A new module gets its
 * entry here and its sections in `anchors.ts`; modules without one are listed
 * as "À venir".
 */
export const DOC_PAGES: Record<DocModuleId, ComponentType> = {
  nests: NestsDoc,
  traps: TrapsDoc,
  apiaries: ApiariesDoc,
  stats: StatsDoc,
  admin: AdminDoc,
};
