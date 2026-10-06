import { useEffect, useState } from 'react';
import { Alert, Button, ButtonGroup, Container, Form, Spinner } from 'react-bootstrap';
import { PageHeader, PageLayout } from '../../components/layout';
import { InvitationsPanel, MembersPanel } from '../../components/groups';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { fetchGroups, groupErrorOf, type AdministeredGroup } from '../../utils/groupsApi';
import { isBeekeeperGroup } from '../../utils/groups';

type Tab = 'members' | 'invitations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'members', label: 'Membres' },
  { id: 'invitations', label: 'Invitations' },
];

/**
 * Administration of a beekeeper group: its members, and the invitations to
 * join it. For the administrators of the group and the platform admins.
 * The coordinators of the trappers get the roster of `/trappers` here, with
 * no invitations: every new account is a trapper.
 */
export default function GroupAdmin() {
  const { isAdmin } = useUserPermissions();
  const [groups, setGroups] = useState<AdministeredGroup[]>([]);
  const [groupPath, setGroupPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('members');

  useEffect(() => {
    let cancelled = false;
    fetchGroups()
      .then((list) => {
        if (cancelled) return;
        setGroups(list);
        setGroupPath(list[0]?.path ?? '');
      })
      .catch((error) => { if (!cancelled) setLoadError(groupErrorOf(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const group = groups.find((candidate) => candidate.path === groupPath);
  const invitable = group ? isBeekeeperGroup(group.path) : false;

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader
          title={isAdmin ? 'Groupes' : 'Mon groupe'}
          help="Gérez les membres et les invitations d'une association d'apiculteurs, ou consultez la liste des piégeurs."
        />

        {loading && <Spinner animation="border" role="status" />}
        {loadError && <Alert variant="danger">{loadError}</Alert>}
        {!loading && !loadError && !group && (
          <p className="text-muted">Vous n'administrez aucun groupe.</p>
        )}

        {group && (
          <>
            {groups.length > 1 ? (
              <Form.Select
                className="mb-3"
                aria-label="Groupe"
                value={groupPath}
                onChange={(event) => setGroupPath(event.target.value)}
              >
                {groups.map((candidate) => <option key={candidate.path} value={candidate.path}>{candidate.name}</option>)}
              </Form.Select>
            ) : (
              <div className="fw-semibold text-truncate mb-3">
                <i className="bi bi-people me-2" aria-hidden="true" />
                {group.name}
              </div>
            )}

            {/* `/trappers` takes no invitations: every new account is a trapper */}
            {invitable && (
              <ButtonGroup className="d-flex mb-3" role="tablist" aria-label="Section">
                {TABS.map(({ id, label }) => (
                  <Button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    variant={tab === id ? 'primary' : 'outline-primary'}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </Button>
                ))}
              </ButtonGroup>
            )}

            {/* Keyed by group: switching groups starts each panel afresh */}
            {tab === 'members' || !invitable
              ? <MembersPanel key={group.path} groupPath={group.path} groupName={group.name} isPlatformAdmin={isAdmin} />
              : <InvitationsPanel key={group.path} groupPath={group.path} groupName={group.name} />}
          </>
        )}
      </Container>
    </PageLayout>
  );
}
