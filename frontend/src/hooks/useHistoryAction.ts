import { useNavigate } from 'react-router-dom';
import type { SheetAction } from '../components/ui';
import { ACTION_ICONS } from '../utils/icons';
import { useUserPermissions } from './useUserPermissions';

/**
 * "Historique" entry of an object sheet's actions, for platform admins only:
 * opens the audit trail on everything that concerns the object.
 */
export function useHistoryAction() {
  const { isAdmin } = useUserPermissions();
  const navigate = useNavigate();
  return (ref: string, name: string): SheetAction | false => isAdmin && {
    icon: ACTION_ICONS.history,
    label: 'Historique',
    onClick: () => navigate(`/admin/audit?${new URLSearchParams({ ref, ref_name: name })}`),
  };
}
