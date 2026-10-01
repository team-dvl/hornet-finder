import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, ListGroup, Spinner } from 'react-bootstrap';
import { HelpTip, UserAvatar } from '../common';
import { BottomSheet, ConfirmDialog, IconButton } from '../ui';
import {
  fetchMembers, groupErrorOf, removeMember, setMemberAdmin, type GroupMember,
} from '../../utils/groupsApi';
import { TRAPPERS_ROOT } from '../../utils/groups';

const PAGE_SIZE = 10;

type Pending = { kind: 'remove' | 'name' | 'dismiss'; member: GroupMember };

interface MembersPanelProps {
  groupPath: string;
  groupName: string;
  /** Naming or dismissing an administrator, and removing one, is for platform admins */
  isPlatformAdmin: boolean;
}

/**
 * Whether the viewer may act on this member: never on themselves, on an
 * administrator only as a platform admin, and on a trapper only as a platform
 * admin (leaving `/trappers` withdraws the role).
 */
function canManage(member: GroupMember, isPlatformAdmin: boolean, trappers: boolean): boolean {
  if (trappers && !isPlatformAdmin) return false;
  return !member.is_self && (!member.is_admin || isPlatformAdmin);
}

/**
 * Members of a beekeeper group, for its administrators and the platform
 * admins, or every trapper (`/trappers`), for their coordinators. A member is
 * removed from here; naming or dismissing an administrator, and removing a
 * trapper, is for platform admins only.
 */
export default function MembersPanel({ groupPath, groupName, isPlatformAdmin }: MembersPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [hasAdminGroup, setHasAdminGroup] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [selected, setSelected] = useState<GroupMember | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const trappers = groupPath === TRAPPERS_ROOT;

  const load = useCallback(async () => {
    const roster = await fetchMembers(groupPath);
    setMembers(roster.members);
    setHasAdminGroup(roster.has_admin_group);
    return roster;
  }, [groupPath]);

  useEffect(() => {
    let cancelled = false;
    fetchMembers(groupPath)
      .then((roster) => {
        if (cancelled) return;
        setMembers(roster.members);
        setHasAdminGroup(roster.has_admin_group);
      })
      .catch((error) => { if (!cancelled) setLoadError(groupErrorOf(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupPath]);

  const pageCount = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const shown = members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const label = (member: GroupMember) => member.name ?? 'Ce compte sans nom';

  // The sheet gives way to the confirmation: one dialog at a time
  const ask = (kind: Pending['kind'], member: GroupMember) => {
    setSelected(null);
    setActionError(null);
    setPending({ kind, member });
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'remove') await removeMember(groupPath, pending.member.guid);
      else await setMemberAdmin(groupPath, pending.member.guid, pending.kind === 'name');
      const done = {
        remove: `${label(pending.member)} ne fait plus partie du groupe.`,
        name: `${label(pending.member)} administre maintenant le groupe.`,
        dismiss: `${label(pending.member)} n'administre plus le groupe.`,
      }[pending.kind];
      const roster = await load();
      setPage((current) => Math.min(current, Math.max(0, Math.ceil(roster.members.length / PAGE_SIZE) - 1)));
      setNotice(done);
      setPending(null);
    } catch (error) {
      setActionError(groupErrorOf(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmation = pending && {
    remove: {
      title: `Retirer ${label(pending.member)} ?`,
      message: trappers
        ? "La personne n'est plus piégeur : elle perd l'accès à ses pièges au plus tard dans l'heure (renouvellement de sa connexion). Ses pièges ne sont pas supprimés."
        : `La personne perd l'accès à ce qui est partagé avec ${groupName}, au plus tard dans l'heure (renouvellement de sa connexion). Ses propres données ne sont pas supprimées.`,
      confirmLabel: 'Retirer',
      confirmIcon: 'person-dash',
      variant: 'danger' as const,
    },
    name: {
      title: `Nommer ${label(pending.member)} administrateur ?`,
      message: trappers
        ? 'La personne pourra consulter la liste des piégeurs.'
        : `La personne pourra inviter et retirer des membres de ${groupName}.`,
      confirmLabel: 'Nommer',
      confirmIcon: 'shield-plus',
      variant: 'primary' as const,
    },
    dismiss: {
      title: `Retirer les droits d'administrateur de ${label(pending.member)} ?`,
      message: 'La personne reste membre du groupe.',
      confirmLabel: 'Retirer les droits',
      confirmIcon: 'shield-minus',
      variant: 'warning' as const,
    },
  }[pending.kind];

  if (loading) return <Spinner animation="border" role="status" />;
  if (loadError) return <Alert variant="danger">{loadError}</Alert>;

  return (
    <section>
      <h2 className="h5 d-flex align-items-center mb-3">
        Membres ({members.length})
        {trappers ? (
          <HelpTip id="members-help" title="Piégeurs">
            Toute personne inscrite est piégeur. Les coordinateurs voient les piégeurs par leur nom, jamais leur adresse email.
            Seul un administrateur de la plateforme retire un piégeur ou nomme un coordinateur.
          </HelpTip>
        ) : (
          <HelpTip id="members-help" title="Membres du groupe">
            Les administrateurs du groupe voient les membres par leur nom, jamais leur adresse email.
            Retirer un membre prend effet au plus tard dans l'heure, au renouvellement de sa connexion.
            Seul un administrateur de la plateforme nomme ou retire un administrateur du groupe, et un groupe en garde toujours au moins un.
          </HelpTip>
        )}
      </h2>

      {notice && <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert>}
      {isPlatformAdmin && !hasAdminGroup && (
        <Alert variant="warning">Ce groupe n'a pas de sous-groupe « admin » dans Keycloak : aucun administrateur ne peut y être nommé.</Alert>
      )}

      <ListGroup>
        {shown.map((member) => (
          <ListGroup.Item key={member.guid} className="d-flex align-items-center gap-2 py-2 px-2">
            <UserAvatar url={null} size={36} />
            <div className="flex-grow-1 min-w-0">
              <div className="text-truncate">
                {member.name ?? <span className="text-muted">Compte sans nom</span>}
              </div>
              {member.is_self && <div className="small text-muted">vous</div>}
            </div>
            {member.is_admin && <Badge bg="primary" className="flex-shrink-0">Admin</Badge>}
            {canManage(member, isPlatformAdmin, trappers) && (
              <IconButton
                variant="outline-secondary"
                icon="three-dots"
                label={`Actions pour ${member.name ?? 'ce compte'}`}
                showLabel="never"
                onClick={() => setSelected(member)}
              />
            )}
          </ListGroup.Item>
        ))}
      </ListGroup>

      {pageCount > 1 && (
        <div className="d-flex align-items-center justify-content-between mt-3">
          <IconButton variant="outline-secondary" icon="chevron-left" label="Page précédente" showLabel="never"
            disabled={page === 0} onClick={() => setPage(page - 1)} />
          <span className="text-muted">{page + 1} / {pageCount}</span>
          <IconButton variant="outline-secondary" icon="chevron-right" label="Page suivante" showLabel="never"
            disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} />
        </div>
      )}

      <BottomSheet show={selected !== null} onHide={() => setSelected(null)} title={selected?.name ?? 'Compte sans nom'}>
        {selected && (
          <div className="d-grid gap-2">
            {isPlatformAdmin && hasAdminGroup && !selected.is_admin && (
              <Button variant="outline-primary" onClick={() => ask('name', selected)}>
                <i className="bi bi-shield-plus me-2" aria-hidden="true" />Nommer administrateur
              </Button>
            )}
            {isPlatformAdmin && selected.is_admin && (
              <Button variant="outline-warning" onClick={() => ask('dismiss', selected)}>
                <i className="bi bi-shield-minus me-2" aria-hidden="true" />Retirer les droits d'administrateur
              </Button>
            )}
            <Button variant="outline-danger" onClick={() => ask('remove', selected)}>
              <i className="bi bi-person-dash me-2" aria-hidden="true" />Retirer du groupe
            </Button>
          </div>
        )}
      </BottomSheet>

      {confirmation && (
        <ConfirmDialog
          show
          onHide={() => setPending(null)}
          onConfirm={() => void confirm()}
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          confirmIcon={confirmation.confirmIcon}
          variant={confirmation.variant}
          busy={busy}
          error={actionError}
        />
      )}
    </section>
  );
}
