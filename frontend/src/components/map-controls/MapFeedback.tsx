import { Alert, Spinner } from "react-bootstrap";

interface LoadingIndicatorProps {
  loading: boolean;
}

export function LoadingIndicator({ loading }: LoadingIndicatorProps) {
  if (!loading) return null;
  
  return (
    <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 1001 }}>
      <div className="d-flex align-items-center bg-white p-3 rounded shadow">
        <Spinner animation="border" size="sm" className="me-2" />
        <span>Chargement des données...</span>
      </div>
    </div>
  );
}

interface ErrorAlertProps {
  error: string | null;
  onClose: () => void;
}

export function ErrorAlert({ error, onClose }: ErrorAlertProps) {
  if (!error) return null;
  
  return (
    <Alert 
      variant="danger" 
      className="position-absolute start-0 m-3"
      style={{ 
        zIndex: 1001, 
        maxWidth: "300px",
        top: "60px" // Positionné sous les contrôles
      }}
      dismissible
      onClose={onClose}
    >
      {error}
    </Alert>
  );
}
