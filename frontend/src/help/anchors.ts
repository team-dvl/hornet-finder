/**
 * Sections of the module documentation that can be linked to, per module.
 * Each id is the `data-section` of a `<section>` in the module's `*Doc.tsx`;
 * a `HelpTip` points at one with `doc="traps#journal"`, and TypeScript rejects
 * a module or section that is not listed here.
 */
export const DOC_SECTIONS = {
  nests: ['who', 'report', 'access'],
  traps: ['manager', 'placing', 'qr-code', 'journal', 'delegation', 'permissions'],
  apiaries: ['manager', 'adding', 'sharing', 'permissions'],
  stats: ['catches', 'species', 'trap-types', 'ranking', 'view', 'coverage', 'periods', 'scope', 'export'],
} as const;

export type DocModuleId = keyof typeof DOC_SECTIONS;

/** `module` or `module#section` */
export type DocRef = {
  [M in DocModuleId]: M | `${M}#${(typeof DOC_SECTIONS)[M][number]}`;
}[DocModuleId];

/** Splits a reference into its module and (optional) section. */
export function parseDocRef(ref: DocRef): { moduleId: DocModuleId; anchor: string | null } {
  const [moduleId, anchor] = ref.split('#');
  return { moduleId: moduleId as DocModuleId, anchor: anchor ?? null };
}

export function isDocModule(id: string | undefined): id is DocModuleId {
  return id !== undefined && id in DOC_SECTIONS;
}
