import type { ComponentType } from 'react';
import type { ModuleId } from '../../config/modules';
import NestsDoc from './NestsDoc';

/**
 * Documentation page per module. Add an entry here when a module gets its
 * documentation; modules without one show a "coming soon" placeholder.
 */
export const DOC_PAGES: Partial<Record<ModuleId, ComponentType>> = {
  nests: NestsDoc,
};
