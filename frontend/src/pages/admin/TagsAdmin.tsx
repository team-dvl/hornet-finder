import { Container, Tab, Tabs } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, PageLayout } from '../../components/layout';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import TagsManagement from './TagsManagement';
import TagsPrinting from './TagsPrinting';

type TagsTab = 'manage' | 'print';

/**
 * QR Codes page of the administration. An admin gets two tabs, management and
 * printing; any other user only prints their own labels.
 */
export default function TagsAdmin() {
  const { isAdmin } = useUserPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TagsTab = searchParams.get('tab') === 'print' ? 'print' : 'manage';

  return (
    <PageLayout>
      <Container className="py-4">
        <PageHeader title="QR Codes" className="d-print-none" />
        {isAdmin ? (
          <Tabs
            activeKey={tab}
            onSelect={(key) => setSearchParams(key === 'print' ? { tab: 'print' } : {}, { replace: true })}
            className="mb-3 d-print-none"
            mountOnEnter
          >
            <Tab eventKey="manage" title="Gestion">
              <TagsManagement />
            </Tab>
            <Tab eventKey="print" title="Impression">
              <TagsPrinting />
            </Tab>
          </Tabs>
        ) : (
          <TagsPrinting />
        )}
      </Container>
    </PageLayout>
  );
}
