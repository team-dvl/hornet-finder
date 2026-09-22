import type { ComponentType } from 'react';
import type { ModuleId } from '../../config/modules';
import NestsDoc from './NestsDoc';
import TrapsDoc from './TrapsDoc';

/**
 * Documentation page per module. Add an entry here when a module gets its
 * documentation; modules without one show a "coming soon" placeholder.
 */
export const DOC_PAGES: Partial<Record<ModuleId, ComponentType>> = {
  nests: NestsDoc,
  traps: TrapsDoc,
};
