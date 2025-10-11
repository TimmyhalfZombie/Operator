import { api } from '../../lib/http';
import { AssistanceRequest } from './types';

export async function fetchNextAssist(): Promise<AssistanceRequest | null> {
  const res = await api('/api/assist/next', { auth: true });
  return (res?.data ?? null) as AssistanceRequest | null;
}

export async function acceptAssist(id: string): Promise<void> {
  await api(`/api/assist/${id}/accept`, { method: 'POST', auth: true });
}

export async function declineAssist(id: string): Promise<void> {
  await api(`/api/assist/${id}/decline`, { method: 'POST', auth: true });
}
