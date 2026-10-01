import api from './api';
import type { AxiosErrorResponse } from './axiosTypes';

/**
 * Members of the beekeeper groups, see `hornet/group_views.py`. Members are
 * known by first and last name only, never by email. Removing someone or
 * changing an administrator reaches their token at its next refresh.
 */

export interface AdministeredGroup {
  path: string;
  name: string;
}

export interface GroupMember {
  guid: string;
  /** First and last name: `null` for an account without a name */
  name: string | null;
  is_admin: boolean;
  is_self: boolean;
}

export interface GroupRoster {
  members: GroupMember[];
  /** Whether the group has its `admin` subgroup in Keycloak, needed to name an administrator */
  has_admin_group: boolean;
}

export async function fetchGroups(): Promise<AdministeredGroup[]> {
  return (await api.get('/groups/')).data;
}

export async function fetchMembers(groupPath: string): Promise<GroupRoster> {
  return (await api.get('/groups/members/', { params: { group_path: groupPath } })).data;
}

export async function removeMember(groupPath: string, guid: string): Promise<void> {
  await api.delete(`/groups/members/${guid}/`, { params: { group_path: groupPath } });
}

/** Platform admins only. */
export async function setMemberAdmin(groupPath: string, guid: string, admin: boolean): Promise<void> {
  const url = `/groups/members/${guid}/admin/`;
  if (admin) await api.put(url, null, { params: { group_path: groupPath } });
  else await api.delete(url, { params: { group_path: groupPath } });
}

/** The server's explanation of a failed call, in French. */
export function groupErrorOf(error: unknown): string {
  const data = (error as AxiosErrorResponse).response?.data;
  if (!data) return 'Le serveur ne répond pas. Réessayez plus tard.';
  return (data.detail as string | undefined) ?? 'Une erreur est survenue.';
}
