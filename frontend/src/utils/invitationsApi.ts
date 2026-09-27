import api from './api';
import type { AxiosErrorResponse } from './axiosTypes';

/**
 * Invitations to join a beekeeper group, see `hornet/invitation_views.py`.
 * The invitee is named by their full email address, which the server uses to
 * find the account and never stores; failed lookups are limited per inviter.
 */

export interface InvitableGroup {
  path: string;
  name: string;
}

/** Failed lookups left before the 24 h pause, and its end while it lasts */
export interface LookupState {
  remaining_attempts: number;
  locked_until: string | null;
}

export interface GroupInvitation {
  id: number;
  group_path: string;
  group_name: string;
  /** First and last name only: `null` for an account without a name */
  invitee_name?: string | null;
  invited_by_name: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
}

export type InviteErrorCode = 'no_active_user' | 'locked' | 'self' | 'already_member' | 'already_invited';

export interface InviteError {
  code?: InviteErrorCode;
  detail: string;
  /** Present on `no_active_user` and `locked` */
  lookup?: LookupState;
}

export async function fetchInvitable(): Promise<{ groups: InvitableGroup[]; lookup: LookupState }> {
  return (await api.get('/group-invitations/invitable/')).data;
}

export async function fetchSentInvitations(): Promise<GroupInvitation[]> {
  return (await api.get('/group-invitations/')).data;
}

export async function sendInvitation(groupPath: string, email: string): Promise<GroupInvitation> {
  return (await api.post('/group-invitations/', { group_path: groupPath, email })).data;
}

export async function cancelInvitation(id: number): Promise<void> {
  await api.delete(`/group-invitations/${id}/`);
}

export async function fetchMyInvitations(): Promise<GroupInvitation[]> {
  return (await api.get('/me/group-invitations/')).data;
}

export async function answerInvitation(id: number, accept: boolean): Promise<GroupInvitation> {
  return (await api.post(`/me/group-invitations/${id}/${accept ? 'accept' : 'decline'}/`)).data;
}

/** The server's explanation of a failed call, in French. */
export function inviteErrorOf(error: unknown): InviteError {
  const data = (error as AxiosErrorResponse).response?.data;
  if (!data) return { detail: 'Le serveur ne répond pas. Réessayez plus tard.' };
  const lookup = typeof data.remaining_attempts === 'number'
    ? { remaining_attempts: data.remaining_attempts, locked_until: (data.locked_until as string | null) ?? null }
    : undefined;
  const fieldError = [data.email, data.group_path].flat().find((message) => typeof message === 'string');
  return {
    code: data.code as InviteErrorCode | undefined,
    detail: (data.detail as string | undefined) ?? (fieldError as string | undefined) ?? 'Une erreur est survenue.',
    lookup,
  };
}
