import { Badge, Form, Card, Row, Col } from 'react-bootstrap';

export interface ApiaryGroupPermission {
  group: string;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface ApiaryGroupPermissionsProps {
  permissions: ApiaryGroupPermission[];
  readOnly?: boolean;
  onChange?: (group: string, perm: Partial<ApiaryGroupPermission>) => void; // stub pour le mode édition
}

/**
 * Affiche les permissions étendues d'un rucher par groupe sous forme de Cards Bootstrap.
 * readOnly: true => switches désactivés, sinon switches éditables (non implémenté)
 */
export default function ApiaryGroupPermissions({ permissions, readOnly = true, onChange }: ApiaryGroupPermissionsProps) {
  return (
    <Row xs={1} sm={2} md={2} lg={3} className="g-2">
      {permissions.map((perm, idx) => (
        <Col key={perm.group || idx}>
          <Card className="h-100">
            <Card.Header className="bg-light">
              <Badge bg="primary" pill style={{ fontSize: '0.90em', padding: '0.35em 0.7em' }}>
                {perm.group}
              </Badge>
            </Card.Header>
            <Card.Body className="py-2 px-3">
              <div className="d-flex align-items-center mb-2">
                <Form.Check
                  type="switch"
                  id={`can-read-${idx}`}
                  checked={!!perm.can_read}
                  disabled={readOnly}
                  label={<span className="ms-2">peut visualiser</span>}
                  onChange={readOnly ? undefined : () => onChange && onChange(perm.group, { can_read: !perm.can_read })}
                />
              </div>
              <div className="d-flex align-items-center mb-2">
                <Form.Check
                  type="switch"
                  id={`can-update-${idx}`}
                  checked={!!perm.can_update}
                  disabled={readOnly}
                  label={<span className="ms-2">peut modifier</span>}
                  onChange={readOnly ? undefined : () => onChange && onChange(perm.group, { can_update: !perm.can_update })}
                />
              </div>
              <div className="d-flex align-items-center">
                <Form.Check
                  type="switch"
                  id={`can-delete-${idx}`}
                  checked={!!perm.can_delete}
                  disabled={readOnly}
                  label={<span className="ms-2">peut effacer</span>}
                  onChange={readOnly ? undefined : () => onChange && onChange(perm.group, { can_delete: !perm.can_delete })}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
