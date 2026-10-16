import type { NestActor, NestBasis, NestEvent, NestMeans, NestOutcome, NestStatus, NestType } from '../store/store';

/**
 * How the nests module reads: statuses, the classes of a nest, the entries
 * of its journal. One place, shared by the list, the sheet and the forms.
 */

export const NEST_STATUSES: { value: NestStatus; label: string; tone: string }[] = [
  { value: 'reported', label: 'Signalé', tone: 'danger' },
  { value: 'confirmed', label: 'Confirmé', tone: 'warning' },
  { value: 'destroyed', label: 'Neutralisé', tone: 'secondary' },
  { value: 'rejected', label: 'Écarté', tone: 'light' },
  { value: 'abandoned', label: 'Abandonné', tone: 'light' },
];

export function nestStatusInfo(status: NestStatus | undefined) {
  return NEST_STATUSES.find((entry) => entry.value === status) ?? NEST_STATUSES[0];
}

/** Still waiting for something: a visit or a destruction */
export const isOpenStatus = (status: NestStatus | undefined) => !status || status === 'reported' || status === 'confirmed';

/** Shown on the map by default: the others (rejected, abandoned) are of no use in the field */
export const isMapStatus = (status: NestStatus | undefined) => isOpenStatus(status) || status === 'destroyed';

export const NEST_TYPES: { value: Exclude<NestType, ''>; label: string }[] = [
  { value: 'primary', label: 'Primaire' },
  { value: 'secondary', label: 'Secondaire' },
];

export const HEIGHT_CLASSES = [
  { value: '0-2', label: '< 2 m' },
  { value: '2-5', label: '2–5 m' },
  { value: '5-10', label: '5–10 m' },
  { value: '10-20', label: '10–20 m' },
  { value: '20+', label: '> 20 m' },
];

export const SIZE_CLASSES = [
  { value: '0-10', label: '< 10 cm' },
  { value: '10-30', label: '10–30 cm' },
  { value: '30-50', label: '30–50 cm' },
  { value: '50+', label: '> 50 cm' },
];

const labelOf = (list: { value: string; label: string }[], value?: string) =>
  list.find((entry) => entry.value === value)?.label ?? '';

export const nestTypeLabel = (value?: string) => labelOf(NEST_TYPES, value);
export const heightLabel = (value?: string) => labelOf(HEIGHT_CLASSES, value);
export const sizeLabel = (value?: string) => labelOf(SIZE_CLASSES, value);

/**
 * The type a nest probably has, from the date it was reported: the founding
 * queen builds the primary nest in spring (February to May); from July the
 * colony is usually in a secondary nest. June is anyone's guess.
 */
export function suggestedNestType(reportedAt?: string | null): NestType {
  const month = (reportedAt ? new Date(reportedAt) : new Date()).getMonth() + 1;
  if (month >= 2 && month <= 5) return 'primary';
  if (month >= 7) return 'secondary';
  return '';
}

export const VISIT_OUTCOMES: { value: Exclude<NestOutcome, '' | 'unknown'>; label: string }[] = [
  { value: 'active', label: 'Nid actif' },
  { value: 'empty', label: 'Nid vide' },
  { value: 'other_species', label: 'Autre espèce' },
  { value: 'not_found', label: 'Introuvable' },
];

/** What a verification relies on: there is not always someone on the spot */
export const BASES: { value: NestBasis; label: string }[] = [
  { value: 'photos', label: 'Photos' },
  { value: 'call', label: 'Échange avec le signaleur' },
  { value: 'on_site', label: 'Sur place' },
];

export const ACTORS: { value: NestActor; label: string }[] = [
  { value: 'fixmystreet', label: 'FixMyStreet' },
  { value: 'company', label: 'Entreprise privée' },
  { value: 'firefighters', label: 'Pompiers' },
  { value: 'municipality', label: 'Commune' },
  { value: 'other', label: 'Autre' },
  { value: 'unknown', label: 'Je ne sais pas' },
];

export const MEANS: { value: NestMeans; label: string }[] = [
  { value: 'pole', label: 'Perche' },
  { value: 'lift', label: 'Nacelle' },
  { value: 'removed', label: 'Nid retiré' },
  { value: 'other', label: 'Autre' },
];

/** Icon and title of an entry of the journal */
export function nestEventTitle(event: NestEvent): { icon: string; title: string } {
  switch (event.kind) {
    case 'report':
      return { icon: '🏴', title: event.outcome === 'empty' ? 'Signalement : nid vide' : 'Signalement' };
    case 'visit':
      return { icon: '🔍', title: `Vérification : ${labelOf(VISIT_OUTCOMES, event.outcome).toLowerCase() || 'sans résultat'}` };
    case 'destruction':
      return { icon: '✅', title: 'Neutralisation' };
    case 'season_end':
      return { icon: '❄️', title: 'Fin de saison : abandonné' };
    case 'reactivation':
      return { icon: '↩️', title: 'Réactivé' };
    default:
      return { icon: '•', title: event.kind };
  }
}

/** What an entry tells besides its title: classes seen at a visit, who destroyed it and how */
export function nestEventDetails(event: NestEvent): string[] {
  const parts: string[] = [];
  if (event.kind === 'visit') {
    const { nest_type: type, height_class: height, size_class: size, basis } = event.details;
    if (basis?.length) parts.push(`sur base de : ${basis.map((item) => labelOf(BASES, item).toLowerCase()).join(', ')}`);
    if (type) parts.push(nestTypeLabel(type).toLowerCase());
    if (height) parts.push(`hauteur ${heightLabel(height)}`);
    if (size) parts.push(`taille ${sizeLabel(size)}`);
  }
  if (event.kind === 'destruction') {
    if (event.actor && event.actor !== 'unknown') parts.push(labelOf(ACTORS, event.actor));
    if (event.fixmystreet_ref) parts.push(`FixMyStreet n° ${event.fixmystreet_ref}`);
    event.means.forEach((means) => parts.push(labelOf(MEANS, means).toLowerCase()));
    if (event.details.date_unknown) parts.push('date inconnue');
  }
  return parts;
}
