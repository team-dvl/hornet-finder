import type { AuditEvent } from './auditApi';
import { formatDate, formatDateTime } from './format';
import { OBJECT_ICONS } from './icons';

/**
 * French labels of the audit trail: actions, domains, objects and the fields
 * of their details. The codes come from `backend/audit/actions.py`; a code
 * missing here shows as is.
 */

export const ACTION_LABELS: Record<string, string> = {
  'hornet.reported': 'Frelon signalé',
  'hornet.updated': 'Frelon modifié',
  'hornet.deleted': 'Frelon supprimé',
  'hornet.archived': 'Frelon archivé',
  'hornet.unarchived': 'Frelon désarchivé',
  'hornet.bulk_archived': 'Frelons archivés (période)',
  'nest.reported': 'Nid signalé',
  'nest.updated': 'Nid modifié',
  'nest.destroyed': 'Nid marqué neutralisé',
  'nest.reactivated': 'Nid réactivé',
  'nest.visited': 'Nid vérifié',
  'nest.event_deleted': 'Entrée du journal de nid supprimée',
  'nest.season_ended': 'Nids non traités abandonnés (fin de saison)',
  'nest.deleted': 'Nid supprimé',
  'nest.photo_added': 'Photos de nid ajoutées',
  'nest.photo_removed': 'Photo de nid retirée',
  'nest.archived': 'Nid archivé',
  'nest.unarchived': 'Nid désarchivé',
  'nest.bulk_archived': 'Nids archivés (période)',
  'nest.owner_changed': 'Nid transféré',
  'apiary.created': 'Rucher créé',
  'apiary.updated': 'Rucher modifié',
  'apiary.deleted': 'Rucher supprimé',
  'apiary.photo_set': 'Photo de rucher changée',
  'apiary.photo_removed': 'Photo de rucher retirée',
  'apiary.shared': 'Rucher partagé',
  'apiary.share_changed': 'Partage de rucher modifié',
  'apiary.unshared': 'Partage de rucher retiré',
  'apiary.owner_changed': 'Rucher transféré',
  'trap.created': 'Piège créé',
  'trap.updated': 'Piège modifié',
  'trap.deleted': 'Piège supprimé',
  'trap.photo_set': 'Photo de piège changée',
  'trap.photo_removed': 'Photo de piège retirée',
  'trap.delegated': 'Piège délégué',
  'trap.undelegated': 'Délégation retirée',
  'trap.owner_changed': 'Piège transféré',
  'trap.restricted': 'Piège rendu privé (propriétaire devenu apiculteur)',
  'trap.event_recorded': 'Entrée de journal',
  'trap.visit_recorded': 'Visite enregistrée',
  'trap.visit_deleted': 'Visite supprimée',
  'trap.event_corrected': 'Entrée corrigée',
  'trap.event_deleted': 'Entrée supprimée',
  'trap.journal_photo_removed': 'Photo de journal retirée',
  'tag.batch_generated': 'QR codes générés',
  'tag.associated': 'QR code associé',
  'tag.revoked': 'QR code révoqué',
  'trap_type.created': 'Type de piège créé',
  'trap_type.updated': 'Type de piège modifié',
  'trap_type.deleted': 'Type de piège supprimé',
  'species.created': 'Espèce créée',
  'species.updated': 'Espèce modifiée',
  'species.deleted': 'Espèce supprimée',
  'species.reordered': 'Espèces réordonnées',
  'group.member_removed': 'Membre retiré',
  'group.admin_named': 'Administrateur nommé',
  'group.admin_dismissed': 'Administrateur destitué',
  'notification.sent': 'Notification envoyée',
  'invitation.sent': 'Invitation envoyée',
  'invitation.reminded': 'Invitation relancée',
  'invitation.cancelled': 'Invitation retirée',
  'invitation.accepted': 'Invitation acceptée',
  'invitation.declined': 'Invitation refusée',
  'invitation.expired': 'Invitation expirée',
  'stats.export_link': 'Export demandé',
  'stats.export_emailed': 'Export envoyé par email',
  'stats.export_downloaded': 'Export téléchargé',
  'platform.notifications_changed': 'Notifications suspendues ou reprises',
  'audit.exported': "Journal d'audit exporté",
};

interface Domain {
  label: string;
  /** Emoji of a map object, else a bootstrap-icons name */
  emoji?: string;
  icon?: string;
}

/** In the order of the filter chips */
export const DOMAINS: Record<string, Domain> = {
  nest: { label: 'Nids', emoji: OBJECT_ICONS.nest },
  hornet: { label: 'Frelons', emoji: OBJECT_ICONS.hornet },
  apiary: { label: 'Ruchers', emoji: OBJECT_ICONS.apiary },
  trap: { label: 'Pièges', emoji: OBJECT_ICONS.trap },
  tag: { label: 'QR codes', icon: 'qr-code' },
  group: { label: 'Groupes', icon: 'people' },
  invitation: { label: 'Invitations', icon: 'envelope' },
  notification: { label: 'Notifications', icon: 'bell' },
  platform: { label: 'Plateforme', icon: 'speedometer2' },
  stats: { label: 'Exports', icon: 'bar-chart-line' },
  trap_type: { label: 'Types de pièges', icon: 'bullseye' },
  species: { label: 'Espèces', icon: 'bug' },
  audit: { label: "Journal d'audit", icon: 'clock-history' },
};

export const actionLabel = (code: string) => ACTION_LABELS[code] ?? code;

export const domainOf = (code: string) => code.split('.', 1)[0];

/** Names of the objects, by `target_type` / ref type */
const OBJECT_NAMES: Record<string, string> = {
  hornet: 'Frelon',
  nest: 'Nid',
  nest_photo: 'Photo de nid',
  apiary: 'Rucher',
  trap: 'Piège',
  trap_event: 'Entrée de journal',
  trap_photo: 'Photo de journal',
  visit: 'Visite',
  tag: 'QR code',
  trap_type: 'Type de piège',
  species: 'Espèce',
  invitation: 'Invitation',
  group: 'Groupe',
  statistic: 'Statistique',
  export: 'Export',
  user: 'Personne',
  platform: 'Plateforme',
  audit: "Journal d'audit",
};

/** Ref types an admin may want the history of (others are details) */
const HISTORY_TYPES = new Set(['hornet', 'nest', 'apiary', 'trap', 'tag', 'group', 'invitation', 'trap_type',
  'species', 'user', 'visit', 'export', 'statistic']);

export const hasHistory = (ref: string) => HISTORY_TYPES.has(ref.split(':', 1)[0]);

/** `Nid #128`, `Groupe /beekeepers/ena`, `Visite` */
export function objectName(type: string, id: string, people?: AuditEvent['people']): string {
  const name = OBJECT_NAMES[type] ?? type;
  if (!id) return name;
  if (type === 'user') return personName(id, people);
  // A statistic is named by its title (`target_label`), not by its identifier
  if (type === 'statistic') return name;
  if (type === 'group') return `${name} ${id}`;
  if (type === 'visit' || type === 'export') return name;
  return `${name} #${id}`;
}

export function refName(ref: string, people?: AuditEvent['people']): string {
  const [type, ...rest] = ref.split(':');
  return objectName(type, rest.join(':'), people);
}

export const shortGuid = (guid: string) => `${guid.slice(0, 4)}…${guid.slice(-4)}`;

export function personName(guid: string, people?: AuditEvent['people']): string {
  const person = people?.[guid];
  if (person?.name) return person.name;
  return person?.deleted ? `Compte supprimé (${shortGuid(guid)})` : shortGuid(guid);
}

/** Who acted, as a sentence: a name, or what stands in for nobody */
export function actorLabel(event: AuditEvent): { text: string; muted: boolean } {
  if (event.actor) {
    if (event.actor_name) return { text: event.actor_name, muted: false };
    return { text: event.actor_deleted ? `Compte supprimé (${shortGuid(event.actor)})` : shortGuid(event.actor), muted: true };
  }
  if (event.action === 'stats.export_downloaded') return { text: 'Sans connexion (lien)', muted: true };
  if (event.source === 'system') return { text: 'Système', muted: true };
  return { text: 'Inconnu', muted: true };
}

export const FIELD_LABELS: Record<string, string> = {
  latitude: 'Latitude',
  longitude: 'Longitude',
  address: 'Adresse',
  public_place: 'Lieu public',
  destroyed: 'Neutralisé',
  destroyed_at: 'Date de neutralisation',
  status: 'Statut',
  nest_type: 'Type de nid',
  height_class: 'Hauteur',
  size_class: 'Taille',
  outcome: 'Résultat',
  basis: 'Sur base de',
  actor: 'Neutralisé par',
  means: 'Moyens',
  state: 'État au signalement',
  comments: 'Commentaires',
  private_comments: 'Commentaire pour les coordinateurs',
  created_by: 'Signalé par',
  archived: 'Archivé',
  direction: 'Direction (°)',
  duration: 'Durée (s)',
  mark_color_1: 'Marque 1',
  mark_color_2: 'Marque 2',
  linked_nest: 'Nid lié',
  infestation_level: "Niveau d'infestation",
  afsca_number: 'N° AFSCA',
  owner: 'Propriétaire',
  photo: 'Photo',
  trap_type: 'Type (n°)',
  installed_at: 'Installé le',
  active: 'En service',
  visibility: 'Visibilité',
  group: 'Groupe (n°)',
  group_path: 'Groupe',
  traps_restricted: 'Pièges rendus privés',
  kind: "Type d'entrée",
  performed_at: 'Date',
  performed_by: 'Par',
  species: 'Espèce (n°)',
  observed_quantity: 'Observés',
  quantity: 'Captures',
  emptied: 'Vidé',
  left_quantity: 'Restés',
  bycatch_counted: 'Autres espèces comptées',
  batch: 'Visite',
  slug: 'Identifiant',
  name: 'Nom',
  description: 'Description',
  sort_order: 'Ordre',
  apiary_bound: 'Lié à un rucher',
  accumulates: 'Accumule les captures',
  reading_interval_days: 'Relevé tous les (jours)',
  refill_interval_days: "Attractif tous les (jours)",
  scientific_name: 'Nom scientifique',
  wikipedia_url: 'Wikipédia',
  photo_credit: 'Crédit photo',
  photo_source_url: 'Source de la photo',
  key_index: 'Clef',
  trap: 'Piège (n°)',
  count: 'Nombre',
  period: 'Période',
  photos: 'Photos',
  short: 'Code',
  replaced_tag: 'Remplace (n°)',
  replaced_short: 'Remplace',
  can_update: 'Peut modifier',
  shared_with: 'Partagé avec',
  events: 'Entrées',
  hornet_catch_count: 'Frelons capturés',
  member: 'Membre',
  was_admin: 'Était administrateur',
  notified: 'Email envoyé',
  reminder: 'Rappel n°',
  format: 'Format',
  params: 'Paramètres',
  via: 'Par',
  download: 'Téléchargement n°',
  expires_at: 'Expire',
  filters: 'Filtres',
  rows: 'Lignes',
  items: 'Espèces',
  actions: 'Actions',
  order: 'Ordre (n°)',
  uploaded_by: 'Ajoutée par',
  uploaded_at: 'Ajoutée le',
  event: 'Entrée (n°)',
  generated_by: 'Généré par',
  associated_by: 'Associé par',
  revoked_by: 'Révoqué par',
  from: 'Reconstitué depuis',
  paused: 'Suspendues',
  resumed: 'Reprises',
};

/** Labels that differ for one type of object: the owner of a nest follows it, it is no legal owner */
const TYPE_FIELD_LABELS: Record<string, Record<string, string>> = {
  nest: { owner: 'Suivi par' },
};

export const fieldLabel = (key: string, targetType?: string) =>
  (targetType && TYPE_FIELD_LABELS[targetType]?.[key]) ?? FIELD_LABELS[key] ?? key;

/** Fields holding a person's GUID (see PERSON_FIELDS in `audit/views.py`) */
const PERSON_FIELDS = new Set(['owner', 'created_by', 'performed_by', 'generated_by', 'associated_by',
  'revoked_by', 'uploaded_by', 'member']);

/** Kinds of notifications the platform admins hold back or resume */
const NOTIFICATION_KINDS: Record<string, string> = {
  trap_reading: 'Rappels de relevé', trap_refill: "Rappels d'attractif", nest_new: 'Tous les nouveaux nids',
  nest_near_apiary: 'Nids près des ruchers', nest_followup: 'Suivi des signalements',
  group_message: 'Messages de groupe', platform_message: 'Messages de la plateforme',
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  // `group` is the former name of `restricted`, kept for the history
  visibility: { public: 'Publique', restricted: 'Restreinte', group: 'Restreinte au groupe' },
  paused: NOTIFICATION_KINDS,
  resumed: NOTIFICATION_KINDS,
  via: { link: 'Lien direct', email: 'Lien envoyé par email' },
  kind: {
    installation: 'Installation', inspection: 'Inspection', cleaning: 'Nettoyage', refill: 'Remplissage',
    repair: 'Réparation', removal: 'Retrait', catch: 'Capture',
    visit: 'Vérification', destruction: 'Neutralisation', reactivation: 'Réactivation', report: 'Signalement',
    season_end: 'Fin de saison',
  },
  infestation_level: { 1: 'Faible', 2: 'Moyen', 3: 'Élevé' },
  status: {
    reported: 'Signalé', confirmed: 'Confirmé', destroyed: 'Neutralisé', rejected: 'Écarté', abandoned: 'Abandonné',
  },
  nest_type: { primary: 'Primaire', secondary: 'Secondaire' },
  outcome: { active: 'Nid actif', empty: 'Nid vide', other_species: 'Autre espèce', not_found: 'Introuvable' },
  basis: { photos: 'Photos', call: 'Échange avec le signaleur', on_site: 'Sur place' },
  means: { pole: 'Perche', lift: 'Nacelle', removed: 'Nid retiré', other: 'Autre' },
  state: { active: 'Actif', empty: 'Vide', unknown: 'Inconnu' },
  actor: {
    fixmystreet: 'FixMyStreet', company: 'Entreprise privée', firefighters: 'Pompiers', municipality: 'Commune',
    other: 'Autre', unknown: 'Inconnu',
  },
};

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value of the details as text: dates, yes/no, names instead of GUIDs */
export function formatValue(key: string, value: unknown, people?: AuditEvent['people']): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (PERSON_FIELDS.has(key) && typeof value === 'string') return personName(value, people);
  if (typeof value === 'string' || typeof value === 'number') {
    const named = VALUE_LABELS[key]?.[String(value)];
    if (named) return named;
    if (typeof value === 'string' && DATE_TIME.test(value)) return formatDateTime(value);
    if (typeof value === 'string' && DATE.test(value)) return formatDate(value);
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== 'object' || item === null)) {
      return value.map((item) => formatValue(key, item, people)).join(', ');
    }
    if (key === 'items') {
      return value.map((item) => {
        const { species, observed, left } = item as { species?: string; observed?: number; left?: number };
        return `${species ?? '?'} : ${observed ?? '?'}${left !== undefined ? ` (${left} restés)` : ''}`;
      }).join(', ');
    }
    return `${value.length} élément${value.length > 1 ? 's' : ''}`;
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

/** `{field: [before, after]}` entries of an update, the other entries of the details */
export function splitChanges(changes: Record<string, unknown>) {
  const diffs: [string, unknown, unknown][] = [];
  const facts: [string, unknown][] = [];
  for (const [key, value] of Object.entries(changes)) {
    if (Array.isArray(value) && value.length === 2 && key !== 'items' && key !== 'actions'
        && key !== 'order' && key !== 'shared_with' && key !== 'events'
        && value.every((item) => typeof item !== 'object' || item === null)) {
      diffs.push([key, value[0], value[1]]);
    } else {
      facts.push([key, value]);
    }
  }
  return { diffs, facts };
}

/** One line under the action in the list: the object, its label, what changed */
export function eventSummary(event: AuditEvent): string {
  const parts: string[] = [];
  if (event.target_type) parts.push(objectName(event.target_type, event.target_id, event.people));
  if (event.target_label) parts.push(event.target_label);
  const { diffs } = splitChanges(event.changes);
  const c = event.changes as Record<string, unknown>;
  if (event.action.endsWith('owner_changed') && Array.isArray(c.owner)) {
    parts.push(`${formatValue('owner', c.owner[0], event.people)} → ${formatValue('owner', c.owner[1], event.people)}`);
  } else if (event.action === 'trap.delegated' || event.action === 'trap.undelegated') {
    const path = c.group_path as [string | null, string | null] | undefined;
    if (path) parts.push(`${path[0] ?? 'aucun'} → ${path[1] ?? 'aucun'}`);
  } else if (event.action === 'stats.export_downloaded') {
    parts.push([String(c.format ?? '').toUpperCase(), formatValue('via', c.via)].filter(Boolean).join(' · '));
  } else if (typeof c.count === 'number') {
    parts.push(String(c.count));
  } else if (diffs.length > 0 && !event.action.endsWith('destroyed')) {
    parts.push(diffs.map(([key]) => fieldLabel(key, event.target_type)).join(', '));
  }
  return parts.join(' · ');
}
