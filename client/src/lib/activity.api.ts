import { api } from './http';

export type AssistItem = {
  id: string;
  status: 'pending' | 'accepted' | 'completed' | string;
  vehicle?: any;
  location?: any;
  createdAt?: string;
  updatedAt?: string;
  assignedTo?: string | null;
  userId?: string | null;
};

/** Operator inbox: everyone’s requests */
export async function fetchOperatorInbox(params?: { status?: string; limit?: number }): Promise<AssistItem[]> {
  const q: string[] = [];
  if (params?.status) q.push(`status=${encodeURIComponent(params.status)}`);
  if (params?.limit) q.push(`limit=${params.limit}`);
  const qs = q.length ? `?${q.join('&')}` : '';
  const data = await api(`/api/assist/inbox${qs}`, { auth: true, method: 'GET' });
  return (data?.items || []) as AssistItem[];
}
